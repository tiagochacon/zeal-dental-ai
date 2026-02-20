import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Dentist profile fields
  croNumber: varchar("croNumber", { length: 50 }),
  phone: varchar("phone", { length: 30 }),
  specialty: varchar("specialty", { length: 100 }),
  clinicAddress: text("clinicAddress"),
  // Stripe subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "inactive", "past_due", "canceled", "trialing"]).default("inactive").notNull(),
  priceId: varchar("priceId", { length: 255 }),
  // Subscription tier for feature gating
  subscriptionTier: mysqlEnum("subscriptionTier", ["trial", "basic", "pro", "unlimited"]).default("trial").notNull(),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  // Trial fields
  trialStartedAt: timestamp("trialStartedAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  // Usage tracking
  consultationCount: int("consultationCount").default(0).notNull(),
  consultationCountResetAt: timestamp("consultationCountResetAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Patients table - stores patient information
 */
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  dentistId: int("dentistId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  cpf: varchar("cpf", { length: 14 }),
  medicalHistory: text("medicalHistory"),
  allergies: text("allergies"),
  medications: text("medications"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

/**
 * Consultations table - stores consultation records
 */
export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  dentistId: int("dentistId").notNull(),
  patientId: int("patientId").notNull(),
  patientName: varchar("patientName", { length: 255 }).notNull(),
  
  // Audio data
  audioUrl: text("audioUrl"),
  audioFileKey: text("audioFileKey"),
  audioDurationSeconds: int("audioDurationSeconds"),
  
  // Transcription
  transcript: text("transcript"),
  transcriptSegments: json("transcriptSegments"),
  
  // AI Analysis and SOAP note
  soapNote: json("soapNote").$type<SOAPNote>(),

  // Treatment plan (editable and exportable)
  treatmentPlan: json("treatmentPlan").$type<TreatmentPlan>(),
  
  // Neurovendas Analysis
  neurovendasAnalysis: json("neurovendasAnalysis").$type<NeurovendasAnalysis>(),
  
  // Metadata
  templateUsed: varchar("templateUsed", { length: 50 }),
  status: mysqlEnum("status", ["draft", "transcribed", "reviewed", "finalized"]).default("draft").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  finalizedAt: timestamp("finalizedAt"),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

/**
 * Audio chunks table - stores progressive audio chunks for resilient recording
 */
export const audioChunks = mysqlTable("audioChunks", {
  id: int("id").autoincrement().primaryKey(),
  consultationId: int("consultationId").notNull(),
  recordingSessionId: varchar("recordingSessionId", { length: 64 }).notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  fileKey: text("fileKey").notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 50 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  durationSeconds: int("durationSeconds"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type AudioChunk = typeof audioChunks.$inferSelect;
export type InsertAudioChunk = typeof audioChunks.$inferInsert;

/**
 * Feedbacks table - stores consultation feedbacks (mandatory)
 */
export const feedbacks = mysqlTable("feedbacks", {
  id: int("id").autoincrement().primaryKey(),
  consultationId: int("consultationId").notNull(),
  dentistId: int("dentistId").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = typeof feedbacks.$inferInsert;

/**
 * Consultation templates - predefined templates for different consultation types
 */
export const consultationTemplates = mysqlTable("consultationTemplates", {
  id: int("id").autoincrement().primaryKey(),
  dentistId: int("dentistId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 50 }),
  promptCustomization: text("promptCustomization"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsultationTemplate = typeof consultationTemplates.$inferSelect;
export type InsertConsultationTemplate = typeof consultationTemplates.$inferInsert;

/**
 * SOAP Note structure for dental consultations
 */
export interface PatientProfile {
  type: 'reptilian' | 'neocortex' | 'limbic';
  confidence: number;
  primaryTraits: string[];
  detectedKeywords: string[];
  recommendedApproach: string;
  triggers: {
    positive: string[];
    negative: string[];
  };
}

export interface SOAPNote {
  urgency?: "high" | "medium" | "low";
  patientProfile?: PatientProfile;
  subjective: {
    queixa_principal: string;
    historia_doenca_atual: string;
    historico_medico: string[];
    medicacoes: Array<{
      nome: string;
      dose: string;
      frequencia: string;
    }>;
  };
  objective: {
    exame_clinico_geral: string;
    exame_clinico_especifico: string[];
    dentes_afetados: string[];
    classificacoes_dentes?: Array<{
      numero: string;
      classificacao: "not_evaluated" | "healthy" | "cavity" | "restored" | "missing" | "fractured" | "root_canal" | "crown" | "extraction";
      notas?: string;
    }>;
  };
  assessment: {
    diagnosticos: string[];
    red_flags: string[];
  };
  plan: {
    tratamentos: Array<{
      procedimento: string;
      dente: string;
      urgencia: "alta" | "media" | "baixa";
      prazo?: string;
    }>;
    orientacoes: string[];
    lembretes_clinicos: string[];
  };
}

/**
 * Treatment plan structure for dental consultations
 */
export interface TreatmentPlan {
  summary?: string;
  steps: Array<{
    title: string;
    description: string;
    duration?: string;
    frequency?: string;
    notes?: string;
  }>;
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    duration?: string;
    notes?: string;
  }>;
  postOpInstructions: string[];
  warnings: string[];
}

/**
 * Transcript segment structure from Whisper API
 */
export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: "dentist" | "patient";
}

/**
 * Neurovendas Analysis structure for sales intelligence
 */
/**
 * Payment logs table for Stripe webhook audit trail
 */
export const paymentLogs = mysqlTable("payment_logs", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull().unique(), // Stripe event ID for idempotency
  eventType: varchar("eventType", { length: 100 }).notNull(),
  userId: int("userId"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  priceId: varchar("priceId", { length: 255 }),
  productId: varchar("productId", { length: 255 }),
  planType: mysqlEnum("planType", ["trial", "basic", "pro", "unlimited"]),
  amount: int("amount"), // Amount in cents
  currency: varchar("currency", { length: 10 }),
  status: mysqlEnum("status", ["success", "failed", "duplicate", "ignored"]).notNull(),
  errorMessage: text("errorMessage"),
  rawPayload: json("rawPayload"),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export type PaymentLog = typeof paymentLogs.$inferSelect;
export type InsertPaymentLog = typeof paymentLogs.$inferInsert;

export interface NeurovendasAnalysis {
  perfilPsicografico: {
    nivelCerebralDominante: "neocortex" | "limbico" | "reptiliano";
    motivacaoPrimaria: "alivio_dor" | "estetica" | "status" | "saude";
    nivelAnsiedade: number;
    nivelReceptividade: number;
    descricaoPerfil: string;
  };
  objecoes: {
    verdadeiras: Array<{
      texto: string;
      categoria: "financeira" | "medo" | "tempo" | "confianca" | "outra";
      tecnicaSugerida: string;
    }>;
    ocultas: Array<{
      texto: string;
      sinaisDetectados: string;
      perguntaReveladora: string;
    }>;
  };
  sinaisLinguagem: {
    positivos: string[];
    negativos: string[];
    palavrasChaveEmocionais: string[];
  };
  gatilhosMentais: Array<{
    nome: "transformacao" | "saude_longevidade" | "status" | "conforto" | "exclusividade";
    justificativa: string;
    exemploFrase: string;
  }>;
  scriptPARE: {
    problema: string;
    amplificacao: string;
    resolucao: string;
    engajamento: string;
  };
  tecnicaObjecao: {
    tipo: "LAER" | "redirecionamento";
    passos: string[];
  };
  rapport: {
    nivel: number;
    breakdown: {
      validacaoEmocional: number;
      espelhamentoLinguistico: number;
      escutaAtiva: number;
      equilibrioTurnos: number;
      ausenciaInterrupcoes: number;
    };
    justificativa: string;
    melhoria: string;
    pontosFortesRelacionamento: string[];
    acoesParaMelhorar: string[];
  };
  resumoExecutivo: string;
}
