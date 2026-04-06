/**
 * Database layer \u2014 powered by Supabase (PostgreSQL).
 * Preserves the same exported function signatures as the original Drizzle/MySQL version.
 *
 * NOTE ON RLS: This layer uses the anon key. Ensure Row Level Security is either
 * disabled on these tables or properly configured for server-side access.
 */
import { supabase } from "./lib/supabaseClient";
import { ENV } from "./_core/env";

// Re-export types from schema (kept for TypeScript compatibility throughout the project)
export type {
  User,
  InsertUser,
  Patient,
  InsertPatient,
  Consultation,
  InsertConsultation,
  Feedback,
  InsertFeedback,
  ConsultationTemplate,
  InsertConsultationTemplate,
  AudioChunk,
  InsertAudioChunk,
  Clinic,
  InsertClinic,
  Lead,
  InsertLead,
  Call,
  InsertCall,
  CallTranscriptSegment,
  SOAPNote,
  TreatmentPlan,
  NeurovendasAnalysis,
} from "../drizzle/schema";

import type {
  User,
  InsertUser,
  Patient,
  InsertPatient,
  Consultation,
  InsertConsultation,
  Feedback,
  InsertFeedback,
  ConsultationTemplate,
  InsertConsultationTemplate,
  AudioChunk,
  InsertAudioChunk,
  Clinic,
  InsertClinic,
  Lead,
  InsertLead,
  Call,
  InsertCall,
  SOAPNote,
  TreatmentPlan,
  NeurovendasAnalysis,
  CallTranscriptSegment,
} from "../drizzle/schema";

// Helper: convert ISO date strings from Supabase to Date objects
function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (typeof val === "string") return new Date(val);
  return new Date();
}

// Helper: throw on Supabase error
function assertNoError(error: { message: string } | null, context = "Database") {
  if (error) throw new Error(`[${context}] ${error.message}`);
}

// Helper: safely parse a JSON field stored as text in Supabase (text columns return strings)
function parseJsonField<T>(val: unknown): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return val as T; // jsonb columns already parsed
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return null;
}

// Helper: serialize an object/value for storage in a Supabase text column
function toJsonText(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val; // already a JSON string
  return JSON.stringify(val);
}

// Helper: normalize User object — Supabase returns numeric columns as strings
function normalizeUser(row: unknown): User {
  if (!row || typeof row !== "object") return row as User;
  const r = row as Record<string, unknown>;
  return {
    ...r,
    id: Number(r.id),
    clinicId: r.clinicId != null ? Number(r.clinicId) : null,
  } as User;
}

// Helper: get next available ID for tables without auto-increment
async function getNextId(tableName: string): Promise<number> {
  const { data } = await supabase
    .from(tableName)
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  const rawId = data && data.length > 0 ? (data[0] as { id: unknown }).id : 0;
  const maxId = Number(rawId) || 0;
  // Add a random offset (1-100) to reduce race condition risk
  return maxId + Math.floor(Math.random() * 10) + 1;
}

/**
 * Legacy compat: returns null (Supabase client is used directly, not via getDb).
 * Kept so existing imports don't break.
 */
export async function getDb() {
  return null;
}

// ==================== USER FUNCTIONS ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const values: Record<string, unknown> = { openId: user.openId };
  const fields = ["name", "email", "loginMethod", "croNumber"] as const;
  for (const f of fields) {
    if (user[f] !== undefined) values[f] = user[f] ?? null;
  }
  if (user.lastSignedIn !== undefined) values.lastSignedIn = user.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString();

  // First try to find existing user by openId
  const { data: existing } = await supabase
    .from("Users")
    .select("id")
    .eq("openId", user.openId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update existing user
    const { error } = await supabase
      .from("Users")
      .update(values)
      .eq("openId", user.openId);
    if (error) {
      console.error("[Database] Failed to update user:", error);
      throw new Error(error.message);
    }
  } else {
    // Insert new user — need explicit id since table has no auto-increment
    const newUserId = await getNextId("Users");
    const { error } = await supabase
      .from("Users")
      .insert({ ...values, id: newUserId });
    if (error) {
      console.error("[Database] Failed to insert user:", error);
      throw new Error(error.message);
    }
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("Users")
    .select("*")
    .eq("openId", openId)
    .limit(1);
  if (error) {
    console.warn("[Database] Cannot get user:", error.message);
    return undefined;
  }
  if (!data || data.length === 0) return undefined;
  return normalizeUser(data[0]);
}

export async function updateUserCRO(userId: number, croNumber: string): Promise<void> {
  const { error } = await supabase.from("Users").update({ croNumber }).eq("id", userId);
  assertNoError(error, "updateUserCRO");
}

export async function updateDentistProfile(
  userId: number,
  data: { name?: string; croNumber?: string; phone?: string; specialty?: string; clinicAddress?: string }
): Promise<void> {
  const { error } = await supabase.from("Users").update(data).eq("id", userId);
  assertNoError(error, "updateDentistProfile");
}

export async function getUserById(userId: number): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("Users")
    .select("*")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as User | undefined ?? undefined;
}

// ==================== PATIENT FUNCTIONS ====================

export async function createPatient(data: InsertPatient): Promise<Patient> {
  const id = await getNextId("Patients");
  const { data: row, error } = await supabase
    .from("Patients")
    .insert({ ...data, id })
    .select()
    .single();
  assertNoError(error, "createPatient");
  const patient = row as Patient;
  patient.id = Number(patient.id);
  return patient;
}

export async function getPatientByNameForDentist(
  dentistId: number,
  name: string
): Promise<Patient | undefined> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  const { data, error } = await supabase
    .from("Patients")
    .select("*")
    .eq("dentistId", dentistId)
    .ilike("name", normalized)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Patient | undefined ?? undefined;
}

export async function getPatientsByDentist(dentistId: number): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("Patients")
    .select("*")
    .eq("dentistId", dentistId)
    .order("updatedAt", { ascending: false });
  assertNoError(error, "getPatientsByDentist");
  return (data ?? []) as Patient[];
}

export async function getPatientsByClinic(clinicId: number): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("Patients")
    .select("*")
    .eq("clinicId", clinicId)
    .order("updatedAt", { ascending: false });
  assertNoError(error, "getPatientsByClinic");
  return (data ?? []) as Patient[];
}

export async function getPatientById(id: number): Promise<Patient | undefined> {
  const { data, error } = await supabase
    .from("Patients")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Patient | undefined ?? undefined;
}

export async function updatePatient(id: number, data: Partial<InsertPatient>): Promise<void> {
  const { error } = await supabase.from("Patients").update(data).eq("id", id);
  assertNoError(error, "updatePatient");
}

export async function deletePatient(id: number): Promise<void> {
  // Get consultations first to cascade delete feedbacks and audioChunks
  const { data: patientConsultations } = await supabase
    .from("Consultations")
    .select("id")
    .eq("patientId", id);

  for (const c of patientConsultations ?? []) {
    await supabase.from("Feedbacks").delete().eq("consultationId", c.id);
    await supabase.from("AudioChunks").delete().eq("consultationId", c.id);
  }
  await supabase.from("Consultations").delete().eq("patientId", id);
  const { error } = await supabase.from("Patients").delete().eq("id", id);
  assertNoError(error, "deletePatient");
}

// ==================== CONSULTATION FUNCTIONS ====================

export async function createConsultation(data: InsertConsultation): Promise<{ id: number }> {
  const id = await getNextId("Consultations");
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("Consultations")
    .insert({ ...data, id, createdAt: now, updatedAt: now })
    .select("id")
    .single();
  assertNoError(error, "createConsultation");
  return { id: Number((row as { id: unknown }).id) };
}

export async function getConsultationsByDentist(dentistId: number): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("Consultations")
    .select("*")
    .eq("dentistId", dentistId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getConsultationsByDentist");
  return (data ?? []) as Consultation[];
}

export async function getConsultationsByClinic(clinicId: number): Promise<Consultation[]> {
  const { data: clinicDentists, error: dentistsError } = await supabase
    .from("Users")
    .select("id")
    .eq("clinicId", clinicId);
  assertNoError(dentistsError, "getConsultationsByClinic.dentists");

  const dentistIds = (clinicDentists ?? []).map((d: { id: number }) => d.id);
  if (dentistIds.length === 0) return [];

  const { data, error } = await supabase
    .from("Consultations")
    .select("*")
    .in("dentistId", dentistIds)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getConsultationsByClinic");
  return (data ?? []) as Consultation[];
}

export async function getConsultationById(id: number): Promise<Consultation | undefined> {
  const { data, error } = await supabase
    .from("Consultations")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  const row = data as Record<string, unknown>;
  return {
    ...row,
    soapNote: parseJsonField<SOAPNote>(row.soapNote),
    treatmentPlan: parseJsonField<TreatmentPlan>(row.treatmentPlan),
    neurovendasAnalysis: parseJsonField<NeurovendasAnalysis>(row.neurovendasAnalysis),
  } as unknown as Consultation;
}

export async function getConsultationsByPatient(
  patientId: number,
  dentistId: number
): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("Consultations")
    .select("*")
    .eq("patientId", patientId)
    .eq("dentistId", dentistId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getConsultationsByPatient");
  return (data ?? []) as Consultation[];
}

export async function getConsultationsByPatientAll(patientId: number): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("Consultations")
    .select("*")
    .eq("patientId", patientId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getConsultationsByPatientAll");
  return (data ?? []) as Consultation[];
}

export async function updateConsultation(
  id: number,
  data: Partial<{
    audioUrl: string | null;
    audioFileKey: string | null;
    audioDurationSeconds: number | null;
    transcript: string | null;
    transcriptSegments: unknown;
    soapNote: SOAPNote | null;
    treatmentPlan: TreatmentPlan | null;
    neurovendasAnalysis: NeurovendasAnalysis | null;
    odontogramData: unknown | null;
    status: "draft" | "transcribed" | "reviewed" | "finalized";
    finalizedAt: Date | null;
  }>
): Promise<void> {
  // Supabase text columns require explicit JSON serialization for object fields
  const toSave: Record<string, unknown> = { ...data };
  if ("soapNote" in data) toSave.soapNote = toJsonText(data.soapNote);
  if ("treatmentPlan" in data) toSave.treatmentPlan = toJsonText(data.treatmentPlan);
  if ("neurovendasAnalysis" in data) toSave.neurovendasAnalysis = toJsonText(data.neurovendasAnalysis);
  if ("odontogramData" in data) toSave.odontogramData = toJsonText(data.odontogramData);
  const { error } = await supabase.from("Consultations").update(toSave).eq("id", id);
  assertNoError(error, "updateConsultation");
}

export async function deleteConsultation(id: number): Promise<void> {
  const { error } = await supabase.from("Consultations").delete().eq("id", id);
  assertNoError(error, "deleteConsultation");
}

// ==================== FEEDBACK FUNCTIONS ====================

export async function createFeedback(data: InsertFeedback): Promise<Feedback> {
  const id = await getNextId("Feedbacks");
  const { data: row, error } = await supabase
    .from("Feedbacks")
    .insert({ ...data, id })
    .select()
    .single();
  assertNoError(error, "createFeedback");
  return row as Feedback;
}

export async function getFeedbackByConsultation(consultationId: number): Promise<Feedback | null> {
  const { data, error } = await supabase
    .from("Feedbacks")
    .select("*")
    .eq("consultationId", consultationId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Feedback | null;
}

export async function deleteFeedbacksByConsultation(consultationId: number): Promise<void> {
  const { error } = await supabase.from("Feedbacks").delete().eq("consultationId", consultationId);
  assertNoError(error, "deleteFeedbacksByConsultation");
}

// ==================== TEMPLATE FUNCTIONS ====================

export async function getDefaultTemplates(): Promise<ConsultationTemplate[]> {
  const { data, error } = await supabase
    .from("ConsultationTemplate")
    .select("*")
    .eq("isDefault", true);
  assertNoError(error, "getDefaultTemplates");
  return (data ?? []) as ConsultationTemplate[];
}

export async function getTemplatesByDentist(dentistId: number): Promise<ConsultationTemplate[]> {
  const { data, error } = await supabase
    .from("ConsultationTemplate")
    .select("*")
    .eq("dentistId", dentistId);
  assertNoError(error, "getTemplatesByDentist");
  return (data ?? []) as ConsultationTemplate[];
}

export async function createTemplate(data: InsertConsultationTemplate): Promise<void> {
  const id = await getNextId("ConsultationTemplate");
  const { error } = await supabase.from("ConsultationTemplate").insert({ ...data, id });
  assertNoError(error, "createTemplate");
}

// ==================== AUDIO CHUNK FUNCTIONS ====================

export async function createAudioChunk(data: InsertAudioChunk): Promise<void> {
  const id = await getNextId("AudioChunks");
  const { error } = await supabase.from("AudioChunks").insert({ ...data, id });
  assertNoError(error, "createAudioChunk");
}

export async function getAudioChunksBySession(
  consultationId: number,
  recordingSessionId: string
): Promise<AudioChunk[]> {
  const { data, error } = await supabase
    .from("AudioChunks")
    .select("*")
    .eq("consultationId", consultationId)
    .eq("recordingSessionId", recordingSessionId)
    .order("chunkIndex", { ascending: true });
  assertNoError(error, "getAudioChunksBySession");
  return (data ?? []) as AudioChunk[];
}

export async function deleteAudioChunks(
  consultationId: number,
  recordingSessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("AudioChunks")
    .delete()
    .eq("consultationId", consultationId)
    .eq("recordingSessionId", recordingSessionId);
  assertNoError(error, "deleteAudioChunks");
}

export async function updateAudioChunkTranscript(
  consultationId: number,
  recordingSessionId: string,
  chunkIndex: number,
  transcriptText: string
): Promise<void> {
  const { error } = await supabase
    .from("AudioChunks")
    .update({
      transcriptText,
      transcriptionStatus: "done",
      transcribedAt: new Date().toISOString(),
    })
    .eq("consultationId", consultationId)
    .eq("recordingSessionId", recordingSessionId)
    .eq("chunkIndex", chunkIndex);
  assertNoError(error, "updateAudioChunkTranscript");
}

export async function updateAudioChunkStatus(
  consultationId: number,
  recordingSessionId: string,
  chunkIndex: number,
  status: "pending" | "transcribing" | "done" | "error",
  error?: string
): Promise<void> {
  const update: Record<string, unknown> = { transcriptionStatus: status };
  if (error) update.transcriptionError = error;
  if (status === "done") update.transcribedAt = new Date().toISOString();

  const { error: dbError } = await supabase
    .from("AudioChunks")
    .update(update)
    .eq("consultationId", consultationId)
    .eq("recordingSessionId", recordingSessionId)
    .eq("chunkIndex", chunkIndex);
  assertNoError(dbError, "updateAudioChunkStatus");
}

export async function getAudioChunksByConsultation(consultationId: number): Promise<AudioChunk[]> {
  const { data, error } = await supabase
    .from("AudioChunks")
    .select("*")
    .eq("consultationId", consultationId)
    .order("chunkIndex", { ascending: true });
  assertNoError(error, "getAudioChunksByConsultation");
  return (data ?? []) as AudioChunk[];
}

export async function deleteAudioChunksByConsultation(consultationId: number): Promise<void> {
  const { error } = await supabase.from("AudioChunks").delete().eq("consultationId", consultationId);
  assertNoError(error, "deleteAudioChunksByConsultation");
}

// ==================== SUBSCRIPTION FUNCTIONS ====================

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: "active" | "inactive" | "past_due" | "canceled" | "trialing";
    subscriptionTier?: "trial" | "basic" | "pro" | "unlimited";
    priceId?: string | null;
    subscriptionEndDate?: Date | null;
    consultationCount?: number;
  }
): Promise<void> {
  const { error } = await supabase.from("Users").update(data).eq("id", userId);
  assertNoError(error, "updateUserSubscription");
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("Users")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeUser(data) : undefined;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("Users")
    .select("*")
    .eq("stripeCustomerId", stripeCustomerId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeUser(data) : undefined;
}

export async function updateUserByStripeCustomerId(
  stripeCustomerId: string,
  data: {
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: "active" | "inactive" | "past_due" | "canceled" | "trialing";
    priceId?: string | null;
    subscriptionEndDate?: Date | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("Users")
    .update(data)
    .eq("stripeCustomerId", stripeCustomerId);
  assertNoError(error, "updateUserByStripeCustomerId");
}

// ==================== TRIAL & BILLING FUNCTIONS ====================

export async function startUserTrial(userId: number, trialEndsAt: Date): Promise<void> {
  const { error } = await supabase
    .from("Users")
    .update({ trialStartedAt: new Date().toISOString(), trialEndsAt: trialEndsAt.toISOString() })
    .eq("id", userId);
  assertNoError(error, "startUserTrial");
}

export async function incrementConsultationCount(userId: number): Promise<void> {
  const { data: rows, error } = await supabase
    .from("Users")
    .select("consultationCount, consultationCountResetAt")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rows) throw new Error("User not found");

  const lastReset = toDate(rows.consultationCountResetAt);
  const now = new Date();
  const isNewMonth =
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear();

  const update = isNewMonth
    ? { consultationCount: 1, consultationCountResetAt: now.toISOString() }
    : { consultationCount: (rows.consultationCount ?? 0) + 1 };

  const { error: updateError } = await supabase.from("Users").update(update).eq("id", userId);
  assertNoError(updateError, "incrementConsultationCount");
}

export async function getConsultationCount(userId: number): Promise<number> {
  const { data: rows, error } = await supabase
    .from("Users")
    .select("consultationCount, consultationCountResetAt")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rows) throw new Error("User not found");

  const lastReset = toDate(rows.consultationCountResetAt);
  const now = new Date();
  const isNewMonth =
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear();

  return isNewMonth ? 0 : (rows.consultationCount ?? 0);
}

export async function resetMonthlyConsultationCount(userId: number): Promise<void> {
  const { error } = await supabase
    .from("Users")
    .update({ consultationCount: 0, consultationCountResetAt: new Date().toISOString() })
    .eq("id", userId);
  assertNoError(error, "resetMonthlyConsultationCount");
}

export async function resetConsultationCount(userId: number): Promise<void> {
  const { error } = await supabase
    .from("Users")
    .update({ consultationCount: 0, consultationCountResetAt: new Date().toISOString() })
    .eq("id", userId);
  assertNoError(error, "resetConsultationCount");
}

// ==================== ADMIN FUNCTIONS ====================

export async function resetUserAccount(email: string) {
  const { data: userRows, error: userError } = await supabase
    .from("Users")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!userRows) throw new Error(`Usuário com email ${email} não encontrado`);

  const user = normalizeUser(userRows);

  const { data: userConsultations } = await supabase
    .from("Consultations")
    .select("id")
    .eq("dentistId", user.id);

  const stats = { consultationsDeleted: (userConsultations ?? []).length, patientsDeleted: 0, audioChunksDeleted: 0, feedbacksDeleted: 0 };

  for (const c of userConsultations ?? []) {
    const { data: fbs } = await supabase.from("Feedbacks").select("id").eq("consultationId", c.id);
    stats.feedbacksDeleted += (fbs ?? []).length;
    await supabase.from("Feedbacks").delete().eq("consultationId", c.id);

    const { data: acs } = await supabase.from("AudioChunks").select("id").eq("consultationId", c.id);
    stats.audioChunksDeleted += (acs ?? []).length;
    await supabase.from("AudioChunks").delete().eq("consultationId", c.id);
  }

  await supabase.from("Consultations").delete().eq("dentistId", user.id);

  const { data: userPatients } = await supabase.from("Patients").select("id").eq("dentistId", user.id);
  stats.patientsDeleted = (userPatients ?? []).length;
  await supabase.from("Patients").delete().eq("dentistId", user.id);

  await supabase.from("Users").update({
    subscriptionStatus: "active",
    consultationCount: 0,
    consultationCountResetAt: new Date().toISOString(),
  }).eq("id", user.id);

  return { success: true, message: `Conta ${email} resetada com sucesso`, stats };
}

// ==================== CLINIC FUNCTIONS ====================

export async function createClinic(data: InsertClinic): Promise<Clinic> {
  const id = await getNextId("Clinics");
  const { data: row, error } = await supabase.from("Clinics").insert({ ...data, id }).select().single();
  assertNoError(error, "createClinic");
  return row as Clinic;
}

export async function getClinicById(id: number): Promise<Clinic | undefined> {
  const { data, error } = await supabase
    .from("Clinics")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Clinic | undefined ?? undefined;
}

export async function ensureUserIsGestor(userId: number): Promise<{ clinicId: number }> {
  const { data: userRow, error: userError } = await supabase
    .from("Users")
    .select("*")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!userRow) throw new Error("User not found");

  const currentUser = userRow as User;

  if (currentUser.clinicId) {
    if (currentUser.clinicRole !== "gestor") {
      await supabase.from("Users").update({ clinicRole: "gestor" }).eq("id", userId);
    }
    return { clinicId: currentUser.clinicId };
  }

  const { data: existingClinic } = await supabase
    .from("Clinics")
    .select("*")
    .eq("ownerId", userId)
    .limit(1)
    .maybeSingle();

  if (existingClinic) {
    await supabase.from("Users").update({ clinicId: existingClinic.id, clinicRole: "gestor" }).eq("id", userId);
    return { clinicId: existingClinic.id };
  }

  const clinicName = currentUser.name ? `Clínica ${currentUser.name}` : "Minha Clínica";
  const clinicNextId = await getNextId("Clinics");
  const { data: newClinic, error: clinicError } = await supabase
    .from("Clinics")
    .insert({ id: clinicNextId, name: clinicName, ownerId: userId })
    .select("id")
    .single();
  assertNoError(clinicError, "ensureUserIsGestor.createClinic");

  const clinicId = (newClinic as { id: number }).id;
  await supabase.from("Users").update({ clinicId, clinicRole: "gestor" }).eq("id", userId);
  return { clinicId };
}

export async function getClinicByOwnerId(ownerId: number): Promise<Clinic | undefined> {
  const { data, error } = await supabase
    .from("Clinics")
    .select("*")
    .eq("ownerId", ownerId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Clinic | undefined ?? undefined;
}

export async function updateClinic(id: number, data: Partial<InsertClinic>): Promise<void> {
  const { error } = await supabase.from("Clinics").update(data).eq("id", id);
  assertNoError(error, "updateClinic");
}

export async function getClinicMembers(clinicId: number) {
  const { data, error } = await supabase
    .from("Users")
    .select("id, name, email, clinicRole, createdAt, lastSignedIn")
    .eq("clinicId", clinicId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getClinicMembers");
  return (data ?? []) as Array<{ id: number; name: string | null; email: string | null; clinicRole: string | null; createdAt: Date; lastSignedIn: Date }>;
}

export async function addClinicMember(data: {
  name: string;
  email: string;
  passwordHash: string;
  clinicId: number;
  clinicRole: "crc" | "dentista";
}): Promise<number> {
  const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const memberId = await getNextId("Users");
  const { data: row, error } = await supabase
    .from("Users")
    .insert({
      id: memberId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      openId,
      loginMethod: "email",
      clinicId: data.clinicId,
      clinicRole: data.clinicRole,
      role: "user",
      lastSignedIn: new Date().toISOString(),
      consultationCountResetAt: new Date().toISOString(),
    })
    .select("id")
    .single();
  assertNoError(error, "addClinicMember");
  return (row as { id: number }).id;
}

export async function updateClinicMember(
  userId: number,
  data: { name?: string; clinicRole?: "crc" | "dentista" }
): Promise<void> {
  const { error } = await supabase.from("Users").update(data).eq("id", userId);
  assertNoError(error, "updateClinicMember");
}

export async function removeClinicMember(userId: number): Promise<void> {
  await supabase.from("Feedbacks").delete().eq("dentistId", userId);

  const { data: userConsultations } = await supabase
    .from("Consultations")
    .select("id")
    .eq("dentistId", userId);

  for (const c of userConsultations ?? []) {
    await supabase.from("Feedbacks").delete().eq("consultationId", c.id);
    await supabase.from("AudioChunks").delete().eq("consultationId", c.id);
  }
  await supabase.from("Consultations").delete().eq("dentistId", userId);

  const { data: userPatients } = await supabase.from("Patients").select("id").eq("dentistId", userId);
  for (const p of userPatients ?? []) {
    const { data: pConsultations } = await supabase.from("Consultations").select("id").eq("patientId", p.id);
    for (const pc of pConsultations ?? []) {
      await supabase.from("Feedbacks").delete().eq("consultationId", pc.id);
      await supabase.from("AudioChunks").delete().eq("consultationId", pc.id);
    }
    await supabase.from("Consultations").delete().eq("patientId", p.id);
    await supabase.from("Patients").delete().eq("id", p.id);
  }

  await supabase.from("Calls").delete().eq("crcId", userId);
  await supabase.from("Leads").delete().eq("crcId", userId);
  const { error } = await supabase.from("Users").delete().eq("id", userId);
  assertNoError(error, "removeClinicMember");
}

// ==================== LEAD FUNCTIONS ====================

export async function createLead(data: InsertLead): Promise<Lead> {
  const id = await getNextId("Leads");
  const { data: row, error } = await supabase.from("Leads").insert({ ...data, id }).select().single();
  assertNoError(error, "createLead");
  return row as Lead;
}

export async function getLeadsByClinic(clinicId: number): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("Leads")
    .select("*")
    .eq("clinicId", clinicId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getLeadsByClinic");
  return (data ?? []) as Lead[];
}

export async function getLeadsByCRC(crcId: number): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("Leads")
    .select("*")
    .eq("crcId", crcId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getLeadsByCRC");
  return (data ?? []) as Lead[];
}

export async function getLeadById(id: number): Promise<Lead | undefined> {
  const { data, error } = await supabase
    .from("Leads")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Lead | undefined ?? undefined;
}

export async function updateLead(id: number, data: Partial<InsertLead>): Promise<void> {
  const { error } = await supabase.from("Leads").update(data).eq("id", id);
  assertNoError(error, "updateLead");
}

export async function deleteLead(id: number): Promise<void> {
  const { error } = await supabase.from("Leads").delete().eq("id", id);
  assertNoError(error, "deleteLead");
}

export async function convertLeadToPatient(leadId: number, dentistId: number): Promise<Patient> {
  const { data: leadRow, error: leadError } = await supabase
    .from("Leads")
    .select("*")
    .eq("id", leadId)
    .limit(1)
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);
  if (!leadRow) throw new Error("Lead not found");

  const lead = leadRow as Lead;
  const convertedPatientId = await getNextId("Patients");
  const { data: patientRow, error: patientError } = await supabase
    .from("Patients")
    .insert({
      id: convertedPatientId,
      dentistId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      clinicId: lead.clinicId,
      createdByUserId: lead.crcId,
      originLeadId: leadId,
    })
    .select()
    .single();
  assertNoError(patientError, "convertLeadToPatient.createPatient");

  await supabase.from("Leads").update({ isConverted: true, convertedPatientId: (patientRow as Patient).id }).eq("id", leadId);
  return patientRow as Patient;
}

// ==================== CALL FUNCTIONS ====================

// Normalize Supabase row: map 'callStatus' column → 'status' TypeScript field
function normalizeCall(row: any): Call {
  if (!row) return row;
  const { callStatus, ...rest } = row;
  return {
    ...rest,
    status: callStatus ?? rest.status,
    callInsights: parseJsonField(rest.callInsights),
    neurovendasAnalysis: parseJsonField(rest.neurovendasAnalysis),
  } as Call;
}

export async function createCall(data: InsertCall): Promise<Call> {
  const id = await getNextId("Calls");
  const now = new Date().toISOString();
  // Map TypeScript 'status' field → 'callStatus' column for insert
  const { status, ...insertRest } = data as any;
  const insertData = { ...insertRest, id, createdAt: now, updatedAt: now, ...(status !== undefined ? { callStatus: status } : {}) };
  const { data: row, error } = await supabase.from("Calls").insert(insertData).select().single();
  assertNoError(error, "createCall");
  return normalizeCall(row);
}

export async function getCallsByClinic(clinicId: number): Promise<Call[]> {
  const { data, error } = await supabase
    .from("Calls")
    .select("*")
    .eq("clinicId", clinicId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getCallsByClinic");
  return (data ?? []).map(normalizeCall) as Call[];
}

export async function getCallsByCRC(crcId: number): Promise<Call[]> {
  const { data, error } = await supabase
    .from("Calls")
    .select("*")
    .eq("crcId", crcId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getCallsByCRC");
  return (data ?? []).map(normalizeCall) as Call[];
}

export async function getCallsByLead(leadId: number): Promise<Call[]> {
  const { data, error } = await supabase
    .from("Calls")
    .select("*")
    .eq("leadId", leadId)
    .order("createdAt", { ascending: false });
  assertNoError(error, "getCallsByLead");
  return (data ?? []).map(normalizeCall) as Call[];
}

export async function getCallById(id: number): Promise<Call | undefined> {
  const { data, error } = await supabase
    .from("Calls")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeCall(data) : undefined;
}

export async function updateCall(
  id: number,
  data: Partial<{
    audioUrl: string | null;
    audioFileKey: string | null;
    audioDurationSeconds: number | null;
    transcript: string | null;
    transcriptSegments: CallTranscriptSegment[] | null;
    neurovendasAnalysis: NeurovendasAnalysis | null;
    callInsights: { dor: string; busca: string; trabalha: string; geradoEm: string } | null;
    schedulingResult: "scheduled" | "not_scheduled" | "callback" | "no_answer";
    schedulingNotes: string | null;
    status: "draft" | "transcribed" | "analyzed" | "finalized";
    finalizedAt: Date | null;
  }>
): Promise<void> {
  // Map TypeScript field name 'status' to actual Supabase column name 'callStatus'
  const { status, ...rest } = data as any;
  // Serialize JSON fields for text columns in Supabase
  const toSave: Record<string, unknown> = { ...rest };
  if ("callInsights" in rest) toSave.callInsights = toJsonText(rest.callInsights);
  if ("neurovendasAnalysis" in rest) toSave.neurovendasAnalysis = toJsonText(rest.neurovendasAnalysis);
  const updateData = { ...toSave, ...(status !== undefined ? { callStatus: status } : {}) };
  const { error } = await supabase.from("Calls").update(updateData).eq("id", id);
  assertNoError(error, "updateCall");
}

export async function finalizeCall(
  id: number,
  data: {
    schedulingResult: "scheduled" | "not_scheduled" | "callback" | "no_answer";
    schedulingNotes?: string;
    observations?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("Calls").update({
    ...data,
    callStatus: "finalized",
    finalizedAt: new Date().toISOString(),
  }).eq("id", id);
  assertNoError(error, "finalizeCall");
}

// ==================== CLINIC STATS FUNCTIONS ====================

export async function getClinicStats(clinicId: number) {
  const { data: allLeads } = await supabase.from("Leads").select("id, isConverted").eq("clinicId", clinicId);
  const totalLeads = (allLeads ?? []).length;
  const convertedLeads = (allLeads ?? []).filter((l: { isConverted: boolean }) => l.isConverted).length;

  const { data: allCalls } = await supabase.from("Calls").select("id, schedulingResult").eq("clinicId", clinicId);
  const totalCalls = (allCalls ?? []).length;
  const scheduledCalls = (allCalls ?? []).filter((c: { schedulingResult: string }) => c.schedulingResult === "scheduled").length;

  const { data: clinicMembers } = await supabase.from("Users").select("id").eq("clinicId", clinicId);
  const memberIds = (clinicMembers ?? []).map((m: { id: number }) => m.id);

  const { data: clinicPatients } = await supabase.from("Patients").select("id").eq("clinicId", clinicId);
  const clinicPatientIds = new Set((clinicPatients ?? []).map((p: { id: number }) => p.id));

  const consultationMap = new Map<number, { id: number; treatmentClosed: boolean }>();

  if (memberIds.length > 0) {
    const { data: dentistConsultations } = await supabase
      .from("Consultations")
      .select("id, treatmentClosed")
      .in("dentistId", memberIds);
    for (const c of dentistConsultations ?? []) consultationMap.set(c.id, c);
  }

  if (clinicPatientIds.size > 0) {
    const { data: patientConsultations } = await supabase
      .from("Consultations")
      .select("id, treatmentClosed")
      .in("patientId", Array.from(clinicPatientIds));
    for (const c of patientConsultations ?? []) consultationMap.set(c.id, c);
  }

  const allClinicConsultations = Array.from(consultationMap.values());
  let totalConsultations = allClinicConsultations.length;
  let closedTreatments = allClinicConsultations.filter(c => c.treatmentClosed === true).length;

  if (totalConsultations > 0 && closedTreatments === 0) {
    for (const c of allClinicConsultations) {
      const { data: fbs } = await supabase.from("Feedbacks").select("treatmentClosed").eq("consultationId", c.id);
      if ((fbs ?? []).some((f: { treatmentClosed: boolean }) => f.treatmentClosed === true)) closedTreatments++;
    }
  }

  const members = await getClinicMembers(clinicId);
  const crcCount = members.filter(m => m.clinicRole === "crc").length;
  const dentistaCount = members.filter(m => m.clinicRole === "dentista").length;

  return {
    funnel: { totalLeads, totalCalls, scheduledCalls, convertedLeads, totalConsultations, closedTreatments },
    team: { totalMembers: members.length, crcCount, dentistaCount },
  };
}
