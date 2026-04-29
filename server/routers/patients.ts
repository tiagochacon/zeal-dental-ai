import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  createPatient,
  getPatientsByDentist,
  getPatientsByClinic,
  getPatientById,
  updatePatient,
  deletePatient,
  getPatientByNameForDentist,
  getUserById,
} from "../db";

const createPatientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cpf: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
});

const updatePatientSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cpf: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
});

export const patientsRouter = router({
  create: protectedProcedure
    .input(createPatientSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getPatientByNameForDentist(ctx.user.id, input.name);
      if (existing) {
        return { patient: existing };
      }
      const currentUser = await getUserById(ctx.user.id);
      const patient = await createPatient({
        dentistId: ctx.user.id,
        clinicId: currentUser?.clinicId || undefined,
        createdByUserId: ctx.user.id,
        ...input,
      });
      return { success: true, patient };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (user.clinicId && (user.clinicRole === 'gestor' || user.role === 'admin')) {
      return await getPatientsByClinic(user.clinicId);
    }
    return await getPatientsByDentist(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const patient = await getPatientById(input.id);
      if (!patient) throw new Error("Paciente não encontrado");
      const isOwner = patient.dentistId === ctx.user.id;
      const isClinicGestor = ctx.user.clinicId && patient.clinicId === ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin');
      if (!isOwner && !isClinicGestor) {
        throw new Error("Paciente não encontrado ou acesso negado");
      }
      return patient;
    }),

  update: protectedProcedure
    .input(updatePatientSchema)
    .mutation(async ({ ctx, input }) => {
      const patient = await getPatientById(input.id);
      if (!patient) throw new Error("Paciente não encontrado");
      const isOwner = patient.dentistId === ctx.user.id;
      const isClinicGestor = ctx.user.clinicId && patient.clinicId === ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin');
      if (!isOwner && !isClinicGestor) {
        throw new Error("Paciente não encontrado ou acesso negado");
      }
      const { id, ...updateData } = input;
      await updatePatient(id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const patient = await getPatientById(input.id);
      if (!patient) throw new Error("Paciente não encontrado");
      const isOwner = patient.dentistId === ctx.user.id;
      const isClinicGestor = ctx.user.clinicId && patient.clinicId === ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin');
      if (!isOwner && !isClinicGestor) {
        throw new Error("Paciente não encontrado ou acesso negado");
      }
      await deletePatient(input.id);
      return { success: true };
    }),
});
