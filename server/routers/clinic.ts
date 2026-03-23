// @ts-nocheck - Supabase schema mismatch during migration
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createClinic,
  getClinicById,
  getClinicByOwnerId,
  getClinicMembers,
  addClinicMember,
  updateClinicMember,
  removeClinicMember,
  updateClinic,
  getUserById,
  getClinicStats,
} from "../db";
import { hashPassword } from "../auth";

export const clinicRouter = router({
  // Create a new clinic (gestor only - first time setup)
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome da clínica é obrigatório"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a clinic
      const existing = await getClinicByOwnerId(ctx.user.id);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Você já possui uma clínica cadastrada" });
      }

      const clinic = await createClinic({
        name: input.name,
        ownerId: ctx.user.id,
      });

      // Update user to be gestor of this clinic
      const { updateDentistProfile } = await import("../db");
      await updateDentistProfile(ctx.user.id, {});
      const { supabase } = await import("../lib/supabaseClient");
      await supabase
        .from("users")
        .update({ clinicId: clinic.id, clinicRole: "gestor" })
        .eq("id", ctx.user.id);

      return clinic;
    }),

  // Get current user's clinic
  getMyClinic: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) return null;
      
      const clinic = await getClinicById(user.clinicId);
      return clinic || null;
    }),

  // Update clinic name
  update: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId || user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o gestor pode editar a clínica" });
      }
      
      await updateClinic(user.clinicId, { name: input.name });
      return { success: true };
    }),

  // Get clinic members
  getMembers: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        return [];
      }
      
      // Gestor and CRC can see clinic members (CRC needs to see dentists for lead conversion)
      if (user.clinicRole !== "gestor" && user.clinicRole !== "crc") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      
      return await getClinicMembers(user.clinicId);
    }),

  // Add a member (CRC or Dentista) to the clinic
  addMember: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Senha mínimo 6 caracteres"),
      clinicRole: z.enum(["crc", "dentista"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId || user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o gestor pode adicionar membros" });
      }

      // Check if email already exists
      const { getUserByEmail } = await import("../db");
      const existingUser = await getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado no sistema" });
      }

      const passwordHash = await hashPassword(input.password);
      
      const memberId = await addClinicMember({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        clinicId: user.clinicId,
        clinicRole: input.clinicRole,
      });

      return { id: memberId, success: true };
    }),

  // Update member role
  updateMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      name: z.string().min(1).optional(),
      clinicRole: z.enum(["crc", "dentista"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId || user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o gestor pode editar membros" });
      }

      // Verify member belongs to same clinic
      const member = await getUserById(input.memberId);
      if (!member || member.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Membro não encontrado" });
      }

      const updateData: { name?: string; clinicRole?: "crc" | "dentista" } = {};
      if (input.name) updateData.name = input.name;
      if (input.clinicRole) updateData.clinicRole = input.clinicRole;

      await updateClinicMember(input.memberId, updateData);
      return { success: true };
    }),

  // Remove member from clinic
  removeMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId || user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o gestor pode remover membros" });
      }

      // Verify member belongs to same clinic
      const member = await getUserById(input.memberId);
      if (!member || member.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Membro não encontrado" });
      }

      // Cannot remove self
      if (input.memberId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover a si mesmo" });
      }

      await removeClinicMember(input.memberId);
      return { success: true };
    }),

  // Get clinic stats (funnel + team) - gestor only
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId || user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o gestor pode ver estatísticas" });
      }

      return await getClinicStats(user.clinicId);
    }),
});
