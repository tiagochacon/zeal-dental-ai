import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  patients, InsertPatient, Patient,
  consultations, InsertConsultation, Consultation,
  feedbacks, InsertFeedback, Feedback,
  consultationTemplates, InsertConsultationTemplate, ConsultationTemplate,
  SOAPNote
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

    const textFields = ["name", "email", "loginMethod"] as const;
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
  birthDate?: string;
  clinicName?: string;
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
