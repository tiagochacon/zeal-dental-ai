import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createLead,
  getLeadsByClinic,
  getLeadsByCRC,
  getLeadById,
  updateLead,
  deleteLead,
  convertLeadToPatient,
  getUserById,
  getCallsByLead,
} from "../db";

export const leadsRouter = router({
  // Create a new lead
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você precisa estar vinculado a uma clínica" });
      }
      if (user.clinicRole !== "crc" && user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas CRCs e gestores podem criar leads" });
      }

      const lead = await createLead({
        clinicId: user.clinicId,
        crcId: ctx.user.id,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        source: input.source || null,
        notes: input.notes || null,
      });

      return lead;
    }),

  // List leads (CRC sees own, Gestor sees all from clinic)
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        return [];
      }

      if (user.clinicRole === "gestor") {
        return await getLeadsByClinic(user.clinicId);
      } else if (user.clinicRole === "crc") {
        return await getLeadsByCRC(ctx.user.id);
      }

      return [];
    }),

  // Get lead by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      // CRC can only see own leads
      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      // Get calls for this lead
      const leadCalls = await getCallsByLead(input.id);

      return { ...lead, calls: leadCalls };
    }),

  // Update lead
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { id, ...updateData } = input;
      await updateLead(id, updateData);
      return { success: true };
    }),

  // Delete lead
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      await deleteLead(input.id);
      return { success: true };
    }),

  // Convert lead to patient (assigns to a dentist)
  convert: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      dentistId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.leadId);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (lead.isConverted) {
        throw new TRPCError({ code: "CONFLICT", message: "Este lead já foi convertido em paciente" });
      }

      // Verify dentist belongs to same clinic
      const dentist = await getUserById(input.dentistId);
      if (!dentist || dentist.clinicId !== user.clinicId || dentist.clinicRole !== "dentista") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dentista inválido" });
      }

      const patient = await convertLeadToPatient(input.leadId, input.dentistId);
      return { success: true, patient };
    }),
});
