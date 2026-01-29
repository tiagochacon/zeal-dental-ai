import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG, SUBSCRIPTION_REQUIRED_ERR_MSG } from '@shared/const';
import { hasAccessToPremium, hasReachedConsultationLimit, getRemainingConsultations, hasNegotiationAccess, getUserTier } from '../billing';
import { getConsultationCount } from '../db';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Middleware that requires an active subscription.
 * Use this for premium features like AI transcription and SOAP note generation.
 */
const requireSubscription = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Allow admins to bypass subscription check
  if (ctx.user.role === 'admin') {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // Check if user has active subscription OR active trial
  const activeStatuses = ['active', 'trialing'];
  const hasActiveSubscription = activeStatuses.includes(ctx.user.subscriptionStatus || '');
  
  // Check trial by dates (trialEndsAt > now)
  const hasActiveTrial = ctx.user.trialEndsAt && new Date(ctx.user.trialEndsAt) > new Date();
  
  if (!hasActiveSubscription && !hasActiveTrial) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: SUBSCRIPTION_REQUIRED_ERR_MSG 
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedSubscriptionProcedure = t.procedure.use(requireSubscription);

/**
 * Lista de emails de administradores com acesso ilimitado
 */
const ADMIN_EMAILS = [
  'tiagosennachacon@gmail.com',
  'zealtecnologia@gmail.com',
  'victorodriguez2611@gmail.com',
];

/**
 * Middleware que verifica limites de consultas de forma estrita.
 * DEVE ser usado em rotas que consomem consultas (transcribe, generateSOAP).
 * Verifica ANTES de executar qualquer lógica de AI.
 */
const enforceConsultationLimit = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Admins por role ou por email têm acesso ilimitado
  if (ctx.user.role === 'admin' || ADMIN_EMAILS.includes(ctx.user.email || '')) {
    return next({ ctx: { ...ctx, user: ctx.user, isUnlimited: true } });
  }

  // Verificar se tem acesso premium (assinatura ou trial)
  if (!hasAccessToPremium(ctx.user)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Assinatura ativa ou trial necessária. Acesse /pricing.",
    });
  }

  // VERIFICAR LIMITE ESTRITAMENTE ANTES de executar qualquer lógica
  if (hasReachedConsultationLimit(ctx.user)) {
    const used = ctx.user.consultationCount;
    const tier = getUserTier(ctx.user);
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: `LIMIT_EXCEEDED:${tier}:${used}:Limite de consultas atingido para o seu plano. Faça upgrade para continuar.`,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      isUnlimited: false,
    },
  });
});

export const consultationLimitProcedure = t.procedure.use(enforceConsultationLimit);

/**
 * Middleware que verifica acesso à aba de Negociação.
 * Bloqueia usuários do plano basic de acessar análise de Neurovendas.
 */
const enforceNegotiationAccess = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Admins por role ou por email têm acesso total
  if (ctx.user.role === 'admin' || ADMIN_EMAILS.includes(ctx.user.email || '')) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // Verificar se tem acesso à Negociação
  if (!hasNegotiationAccess(ctx.user)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Upgrade para o plano PRO para acessar a análise de Negociação. Desbloqueie insights de neurovendas para aumentar sua taxa de aceitação de tratamentos.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const negotiationAccessProcedure = t.procedure.use(enforceNegotiationAccess);
