export type AITaskType =
  | "soap"
  | "treatment_plan"
  | "disc_profile"
  | "neurovendas_consultation"
  | "neurovendas_call"
  | "neurovendas_whatsapp"
  | "video_script"
  | "call_insights"
  | "whatsapp_summary"
  | "transcript_revalidation";

export type Criticality = "HIGH" | "MEDIUM" | "LOW";

export type ValidationProfile =
  | "none"
  | "json"
  | "soap"
  | "treatment_plan"
  | "disc_profile"
  | "neurovendas";

export type TaskConfig = {
  criticality: Criticality;
  primaryModel: string;
  fallbackModel: string | null;
  temperature: number;
  maxRetries: number;
  validationProfile: ValidationProfile;
};

export const TASK_CONFIG: Record<AITaskType, TaskConfig> = {
  soap: {
    criticality: "HIGH",
    primaryModel: process.env.AI_MODEL_SOAP || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_SOAP_FALLBACK || null,
    temperature: 0,
    maxRetries: 2,
    validationProfile: "soap",
  },
  treatment_plan: {
    criticality: "HIGH",
    primaryModel: process.env.AI_MODEL_TREATMENT_PLAN || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_TREATMENT_PLAN_FALLBACK || null,
    temperature: 0,
    maxRetries: 2,
    validationProfile: "treatment_plan",
  },
  disc_profile: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_DISC_PROFILE || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_DISC_PROFILE_FALLBACK || null,
    temperature: 0.3,
    maxRetries: 1,
    validationProfile: "disc_profile",
  },
  neurovendas_consultation: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_CONSULTATION || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_CONSULTATION_FALLBACK || null,
    temperature: 0.3,
    maxRetries: 1,
    validationProfile: "neurovendas",
  },
  neurovendas_call: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_CALL || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_CALL_FALLBACK || null,
    temperature: 0.3,
    maxRetries: 1,
    validationProfile: "neurovendas",
  },
  neurovendas_whatsapp: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_WHATSAPP || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_WHATSAPP_FALLBACK || null,
    temperature: 0.3,
    maxRetries: 1,
    validationProfile: "neurovendas",
  },
  video_script: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_VIDEO_SCRIPT || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_VIDEO_SCRIPT_FALLBACK || null,
    temperature: 0.7,
    maxRetries: 1,
    validationProfile: "json",
  },
  call_insights: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_CALL_INSIGHTS || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_CALL_INSIGHTS_FALLBACK || null,
    temperature: 0.2,
    maxRetries: 1,
    validationProfile: "json",
  },
  whatsapp_summary: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_WHATSAPP_SUMMARY || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_WHATSAPP_SUMMARY_FALLBACK || null,
    temperature: 0.2,
    maxRetries: 1,
    validationProfile: "none",
  },
  transcript_revalidation: {
    criticality: "MEDIUM",
    // temperature 0 for fidelity: we only correct STT errors, never rewrite or invent.
    primaryModel: process.env.AI_MODEL_TRANSCRIPT_REVALIDATION || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_TRANSCRIPT_REVALIDATION_FALLBACK || null,
    temperature: 0,
    maxRetries: 1,
    validationProfile: "none",
  },
};
