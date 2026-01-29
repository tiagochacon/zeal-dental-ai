import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  patients, InsertPatient, Patient,
  consultations, InsertConsultation, Consultation,
  feedbacks, InsertFeedback, Feedback,
  consultationTemplates, InsertConsultationTemplate, ConsultationTemplate,
  audioChunks, InsertAudioChunk, AudioChunk,
  SOAPNote,
  TreatmentPlan,
  NeurovendasAnalysis
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER FUNCTIONS ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "croNumber"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserCRO(userId: number, croNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ croNumber }).where(eq(users.id, userId));
}

export async function updateDentistProfile(userId: number, data: {
  name?: string;
  croNumber?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== PATIENT FUNCTIONS ====================

export async function createPatient(data: InsertPatient): Promise<Patient> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(patients).values(data);
  const insertId = result[0].insertId;
  
  const [patient] = await db.select().from(patients).where(eq(patients.id, insertId));
  return patient;
}

export async function getPatientByNameForDentist(
  dentistId: number,
  name: string
): Promise<Patient | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;

  const result = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.dentistId, dentistId),
        eq(sql`lower(${patients.name})`, normalized)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPatientsByDentist(dentistId: number): Promise<Patient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(patients)
    .where(eq(patients.dentistId, dentistId))
    .orderBy(desc(patients.updatedAt));
}

export async function getPatientById(id: number): Promise<Patient | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePatient(id: number, data: Partial<InsertPatient>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(patients).set(data).where(eq(patients.id, id));
}

export async function deletePatient(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(patients).where(eq(patients.id, id));
}

// ==================== CONSULTATION FUNCTIONS ====================

export async function createConsultation(data: InsertConsultation): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(consultations).values(data);
  return { id: result[0].insertId };
}

export async function getConsultationsByDentist(dentistId: number): Promise<Consultation[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(consultations)
    .where(eq(consultations.dentistId, dentistId))
    .orderBy(desc(consultations.createdAt));
}

export async function getConsultationById(id: number): Promise<Consultation | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getConsultationsByPatient(patientId: number, dentistId: number): Promise<Consultation[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(consultations)
    .where(and(
      eq(consultations.patientId, patientId),
      eq(consultations.dentistId, dentistId)
    ))
    .orderBy(desc(consultations.createdAt));
}

export async function updateConsultation(id: number, data: Partial<{
  audioUrl: string | null;
  audioFileKey: string | null;
  audioDurationSeconds: number | null;
  transcript: string | null;
  transcriptSegments: unknown;
  soapNote: SOAPNote | null;
  treatmentPlan: TreatmentPlan | null;
  neurovendasAnalysis: NeurovendasAnalysis | null;
  status: "draft" | "transcribed" | "reviewed" | "finalized";
  finalizedAt: Date | null;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

export async function deleteConsultation(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(consultations).where(eq(consultations.id, id));
}

// ==================== FEEDBACK FUNCTIONS ====================

export async function createFeedback(data: InsertFeedback): Promise<Feedback> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(feedbacks).values(data);
  const insertId = result[0].insertId;
  
  const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.id, insertId));
  return feedback;
}

export async function getFeedbackByConsultation(consultationId: number): Promise<Feedback | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(feedbacks)
    .where(eq(feedbacks.consultationId, consultationId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteFeedbacksByConsultation(consultationId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(feedbacks).where(eq(feedbacks.consultationId, consultationId));
}

// ==================== TEMPLATE FUNCTIONS ====================

export async function getDefaultTemplates(): Promise<ConsultationTemplate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(consultationTemplates)
    .where(eq(consultationTemplates.isDefault, true));
}

export async function getTemplatesByDentist(dentistId: number): Promise<ConsultationTemplate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(consultationTemplates)
    .where(eq(consultationTemplates.dentistId, dentistId));
}

export async function createTemplate(data: InsertConsultationTemplate): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(consultationTemplates).values(data);
}

// ==================== AUDIO CHUNK FUNCTIONS ====================

export async function createAudioChunk(data: InsertAudioChunk): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(audioChunks).values(data);
}

export async function getAudioChunksBySession(
  consultationId: number, 
  recordingSessionId: string
): Promise<AudioChunk[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(audioChunks)
    .where(
      and(
        eq(audioChunks.consultationId, consultationId),
        eq(audioChunks.recordingSessionId, recordingSessionId)
      )
    )
    .orderBy(audioChunks.chunkIndex);
}

export async function deleteAudioChunks(
  consultationId: number, 
  recordingSessionId: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(audioChunks)
    .where(
      and(
        eq(audioChunks.consultationId, consultationId),
        eq(audioChunks.recordingSessionId, recordingSessionId)
      )
    );
}


// ==================== SUBSCRIPTION FUNCTIONS ====================

export async function updateUserSubscription(userId: number, data: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: "active" | "inactive" | "past_due" | "canceled" | "trialing";
  subscriptionTier?: "trial" | "basic" | "pro" | "unlimited";
  priceId?: string | null;
  subscriptionEndDate?: Date | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserByStripeCustomerId(stripeCustomerId: string, data: {
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: "active" | "inactive" | "past_due" | "canceled" | "trialing";
  priceId?: string | null;
  subscriptionEndDate?: Date | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.stripeCustomerId, stripeCustomerId));
}


// ==================== TRIAL & BILLING FUNCTIONS ====================

export async function startUserTrial(userId: number, trialEndsAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({
    trialStartedAt: new Date(),
    trialEndsAt,
  }).where(eq(users.id, userId));
}

export async function incrementConsultationCount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) throw new Error("User not found");
  
  // Check if we need to reset the count (monthly reset)
  const lastReset = user[0].consultationCountResetAt;
  const now = new Date();
  const isNewMonth = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
  
  if (isNewMonth) {
    // Reset count for new month
    await db.update(users).set({
      consultationCount: 1,
      consultationCountResetAt: now,
    }).where(eq(users.id, userId));
  } else {
    // Increment count
    await db.update(users).set({
      consultationCount: user[0].consultationCount + 1,
    }).where(eq(users.id, userId));
  }
}

export async function getConsultationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) throw new Error("User not found");
  
  // Check if we need to reset the count (monthly reset)
  const lastReset = user[0].consultationCountResetAt;
  const now = new Date();
  const isNewMonth = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
  
  if (isNewMonth) {
    return 0; // Reset for new month
  }
  
  return user[0].consultationCount;
}

export async function resetMonthlyConsultationCount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({
    consultationCount: 0,
    consultationCountResetAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function resetConsultationCount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({
    consultationCount: 0,
    consultationCountResetAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function getAudioChunksByConsultation(
  consultationId: number
): Promise<AudioChunk[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(audioChunks)
    .where(eq(audioChunks.consultationId, consultationId))
    .orderBy(audioChunks.chunkIndex);
}

export async function deleteAudioChunksByConsultation(
  consultationId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(audioChunks).where(eq(audioChunks.consultationId, consultationId));
}

// ==================== ADMIN FUNCTIONS ====================

export async function resetUserAccount(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Buscar usuário
  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (userResult.length === 0) {
    throw new Error(`Usuário com email ${email} não encontrado`);
  }
  
  const user = userResult[0];
  
  // 2. Buscar todas as consultas (para estatísticas)
  const userConsultations = await db
    .select()
    .from(consultations)
    .where(eq(consultations.dentistId, user.id));
  
  const stats = {
    consultationsDeleted: userConsultations.length,
    patientsDeleted: 0,
    audioChunksDeleted: 0,
    feedbacksDeleted: 0,
  };
  
  // 3. Deletar feedbacks e audioChunks primeiro (devido a foreign keys)
  for (const consultation of userConsultations) {
    // Deletar feedbacks
    const feedbacksResult = await db
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.consultationId, consultation.id));
    stats.feedbacksDeleted += feedbacksResult.length;
    await db.delete(feedbacks).where(eq(feedbacks.consultationId, consultation.id));
    
    // Deletar audio chunks
    const audioChunksResult = await db
      .select()
      .from(audioChunks)
      .where(eq(audioChunks.consultationId, consultation.id));
    stats.audioChunksDeleted += audioChunksResult.length;
    await db.delete(audioChunks).where(eq(audioChunks.consultationId, consultation.id));
  }
  
  // 4. Deletar consultas
  await db.delete(consultations).where(eq(consultations.dentistId, user.id));
  
  // 5. Contar e deletar pacientes
  const userPatients = await db
    .select()
    .from(patients)
    .where(eq(patients.dentistId, user.id));
  stats.patientsDeleted = userPatients.length;
  await db.delete(patients).where(eq(patients.dentistId, user.id));
  
  // 6. Resetar contadores do usuário
  await db.update(users)
    .set({
      subscriptionStatus: 'active',
      consultationCount: 0,
      consultationCountResetAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  return {
    success: true,
    message: `Conta ${email} resetada com sucesso`,
    stats,
  };
}
