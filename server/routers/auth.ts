import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  getUserById,
  updateUserCRO,
  updateDentistProfile,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
  getUserByEmail,
} from "../db";
import { createUser, authenticateUser, hashPassword } from "../auth";
import { sdk } from "../_core/sdk";
import { notifyOwner } from "../_core/notification";
import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const authRouter = router({
  me: publicProcedure.query(async (opts) => {
    const user = opts.ctx.user;
    if (!user) return null;

    if (user.clinicId && (user.clinicRole === 'crc' || user.clinicRole === 'dentista')) {
      const { getEffectiveBillingUser } = await import('../clinicBilling');
      const gestor = await getEffectiveBillingUser(user);
      if (gestor && gestor.id !== user.id) {
        return {
          ...user,
          subscriptionStatus: gestor.subscriptionStatus,
          subscriptionTier: gestor.subscriptionTier,
          priceId: gestor.priceId,
          subscriptionEndDate: gestor.subscriptionEndDate,
          trialStartedAt: gestor.trialStartedAt,
          trialEndsAt: gestor.trialEndsAt,
          consultationCount: gestor.consultationCount,
          consultationCountResetAt: gestor.consultationCountResetAt,
          gestorName: gestor.name,
          gestorEmail: gestor.email,
        };
      }
    }

    return user;
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  updateCRO: protectedProcedure
    .input(z.object({ croNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await updateUserCRO(ctx.user.id, input.croNumber);
      return { success: true };
    }),

  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new Error("User not found");
      return {
        name: user.name || '',
        croNumber: user.croNumber || '',
        phone: user.phone || '',
        specialty: user.specialty || '',
        clinicAddress: user.clinicAddress || '',
      };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      croNumber: z.string().min(1, "CRO é obrigatório"),
      phone: z.string().optional(),
      specialty: z.string().optional(),
      clinicAddress: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateDentistProfile(ctx.user.id, input);
      return { success: true };
    }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email("Email invalido"),
      password: z.string().min(6, "Senha minimo 6 caracteres"),
      name: z.string().min(1, "Nome obrigatorio"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await createUser({ email: input.email, password: input.password, name: input.name });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        expiresInMs: ONE_YEAR_MS,
        name: user.name
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { id: user.id, email: user.email, name: user.name, role: user.role, redirectTo: '/pricing' };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email("Email inválido") }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user) {
        return { success: true, message: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha." };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await createPasswordResetToken(user.id, user.email || input.email, token, expiresAt);

      const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, "") || "https://zealtecnologia.com";
      const resetUrl = `${origin}/reset-password?token=${token}`;

      const { sendPasswordResetEmail, isEmailConfigured } = await import('../email');

      if (isEmailConfigured()) {
        const emailSent = await sendPasswordResetEmail(
          user.email || input.email,
          user.name || "Usuário",
          resetUrl
        );

        if (emailSent) {
          console.log(`[Auth] Password reset email sent to ${user.email}`);
        } else {
          console.warn(`[Auth] Failed to send email to ${user.email}, falling back to owner notification`);
          await notifyOwner({
            title: `🔑 Recuperação de Senha - ${user.name || user.email}`,
            content: `O usuário ${user.name || ""} (${user.email}) solicitou recuperação de senha.\n\nO envio de e-mail falhou. Envie este link manualmente:\n${resetUrl}\n\nVálido por 1 hora.`,
          });
        }
      } else {
        console.warn(`[Auth] Email not configured, notifying owner for ${user.email}`);
        await notifyOwner({
          title: `🔑 Recuperação de Senha - ${user.name || user.email}`,
          content: `O usuário ${user.name || ""} (${user.email}) solicitou recuperação de senha.\n\nLink de recuperação (válido por 1 hora):\n${resetUrl}\n\nEnvie este link ao usuário para que ele possa redefinir sua senha.`,
        });
      }

      console.log(`[Auth] Password reset requested for ${user.email}, token created`);
      return { success: true, message: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha." };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1, "Token é obrigatório"),
      newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const resetToken = await getPasswordResetToken(input.token);
      if (!resetToken) {
        throw new Error("Token inválido ou expirado. Solicite uma nova recuperação de senha.");
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        await markPasswordResetTokenUsed(input.token);
        throw new Error("Token expirado. Solicite uma nova recuperação de senha.");
      }

      const newHash = await hashPassword(input.newPassword);
      await updateUserPassword(resetToken.userId, newHash);
      await markPasswordResetTokenUsed(input.token);

      console.log(`[Auth] Password reset completed for userId ${resetToken.userId}`);
      return { success: true, message: "Senha redefinida com sucesso! Você já pode fazer login." };
    }),

  emailLogin: publicProcedure
    .input(z.object({ email: z.string().email("Email invalido"), password: z.string().min(1, "Senha obrigatoria") }))
    .mutation(async ({ ctx, input }) => {
      const user = await authenticateUser(input.email, input.password);

      const sessionToken = await sdk.createSessionToken(user.openId, {
        expiresInMs: ONE_YEAR_MS,
        name: user.name || ''
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      if (!user.clinicRole && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')) {
        try {
          const { ensureUserIsGestor } = await import('../db');
          await ensureUserIsGestor(user.id);
          const updatedUser = await getUserById(user.id);
          if (updatedUser) {
            user.clinicRole = updatedUser.clinicRole;
            user.clinicId = updatedUser.clinicId;
          }
          console.log(`[Auth] Auto-fixed: User ${user.id} promoted to gestor on login`);
        } catch (err) {
          console.error(`[Auth] Auto-fix failed for user ${user.id}:`, err);
        }
      }

      let effectiveSubscriptionStatus = user.subscriptionStatus;
      let redirectTo = '/';
      if (user.clinicId && (user.clinicRole === 'crc' || user.clinicRole === 'dentista')) {
        const fullUser = await getUserById(user.id);
        if (fullUser) {
          const { getEffectiveBillingUser } = await import('../clinicBilling');
          const gestor = await getEffectiveBillingUser(fullUser);
          if (gestor && gestor.id !== user.id) {
            effectiveSubscriptionStatus = gestor.subscriptionStatus;
          }
        }
        if (user.clinicRole === 'crc') redirectTo = '/crc';
        else if (user.clinicRole === 'dentista') redirectTo = '/';
      } else if (user.clinicRole === 'gestor') {
        redirectTo = '/gestor';
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: effectiveSubscriptionStatus,
        clinicRole: user.clinicRole,
        clinicId: user.clinicId,
        redirectTo,
      };
    }),
});
