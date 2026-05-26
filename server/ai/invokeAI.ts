import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";

export type AITaskType =
  | "soap"
  | "treatment_plan"
  | "disc_profile"
  | "neurovendas_consultation"
  | "neurovendas_call"
  | "neurovendas_whatsapp"
  | "video_script"
  | "call_insights"
  | "whatsapp_summary";

type Criticality = "HIGH" | "MEDIUM" | "LOW";

export type AIValidationResult = {
  passed: boolean;
  issues: string[];
};

export type AIInvocationLogRecord = {
  invocationId: string;
  taskType: AITaskType;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  validationPassed: boolean | null;
  warningsCount: number;
  inferredContentCount: number;
  consultationId?: number;
  callId?: number;
  leadId?: number;
  createdAt: string;
};

export type InvokeAIOptions = {
  consultationId?: number;
  callId?: number;
  leadId?: number;
  primaryModelOverride?: string;
  fallbackModelOverride?: string | null;
};

export type InvokeAIPayload = Omit<InvokeParams, "model">;

export type InvokeAIResult =
  | {
      success: true;
      taskType: AITaskType;
      invocationId: string;
      model: string;
      fallbackUsed: boolean;
      latencyMs: number;
      response: InvokeResult;
      warnings: string[];
      inferredContent: string[];
      validation?: AIValidationResult;
      createdAt: string;
    }
  | {
      success: false;
      taskType: AITaskType;
      invocationId: string;
      model: string | null;
      fallbackUsed: boolean;
      latencyMs: number;
      error: string;
      primaryError?: string;
      fallbackError?: string;
      warnings: string[];
      inferredContent: string[];
      validation?: AIValidationResult;
      createdAt: string;
    };

type TaskConfig = {
  criticality: Criticality;
  primaryModel: string;
  fallbackModel: string | null;
  temperature: number;
  requiresValidation: boolean;
};

const TASK_CONFIG: Record<AITaskType, TaskConfig> = {
  soap: {
    criticality: "HIGH",
    primaryModel: process.env.AI_MODEL_SOAP || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_SOAP_FALLBACK || null,
    temperature: 0,
    requiresValidation: true,
  },
  treatment_plan: {
    criticality: "HIGH",
    primaryModel: process.env.AI_MODEL_TREATMENT_PLAN || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_TREATMENT_PLAN_FALLBACK || null,
    temperature: 0,
    requiresValidation: true,
  },
  disc_profile: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_DISC_PROFILE || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_DISC_PROFILE_FALLBACK || null,
    temperature: 0.3,
    requiresValidation: true,
  },
  neurovendas_consultation: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_CONSULTATION || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_CONSULTATION_FALLBACK || null,
    temperature: 0.3,
    requiresValidation: false,
  },
  neurovendas_call: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_CALL || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_CALL_FALLBACK || null,
    temperature: 0.3,
    requiresValidation: false,
  },
  neurovendas_whatsapp: {
    criticality: "MEDIUM",
    primaryModel: process.env.AI_MODEL_NEUROVENDAS_WHATSAPP || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_NEUROVENDAS_WHATSAPP_FALLBACK || null,
    temperature: 0.3,
    requiresValidation: false,
  },
  video_script: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_VIDEO_SCRIPT || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_VIDEO_SCRIPT_FALLBACK || null,
    temperature: 0.7,
    requiresValidation: false,
  },
  call_insights: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_CALL_INSIGHTS || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_CALL_INSIGHTS_FALLBACK || null,
    temperature: 0.2,
    requiresValidation: false,
  },
  whatsapp_summary: {
    criticality: "LOW",
    primaryModel: process.env.AI_MODEL_WHATSAPP_SUMMARY || "gemini-2.5-flash",
    fallbackModel: process.env.AI_MODEL_WHATSAPP_SUMMARY_FALLBACK || null,
    temperature: 0.2,
    requiresValidation: false,
  },
};

function generateInvocationId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateClinicalOutput(
  rawContent: string,
  taskType: AITaskType
): AIValidationResult {
  const content = rawContent.trim();
  const issues: string[] = [];

  if (!content) {
    issues.push("Conteúdo vazio");
  }

  if (taskType === "soap") {
    const hasEvidence = /evid[eê]ncia|não documentado na consulta/i.test(content);
    if (!hasEvidence) {
      issues.push("SOAP sem evidência explícita ou marcação de não documentado");
    }
  }

  if (taskType === "treatment_plan") {
    const hasProcedureSignal =
      /procedimento|tratamento|nenhum procedimento discutido/i.test(content);
    if (!hasProcedureSignal) {
      issues.push("Plano sem indicação de procedimentos ou marcação de ausência");
    }
  }

  if (taskType === "disc_profile") {
    const hasAnyDimension = /domin|influ|estab|conform/i.test(content);
    if (!hasAnyDimension) {
      issues.push("DISC sem dimensões identificáveis");
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function extractTextContent(response: InvokeResult): string {
  const content = response.choices?.[0]?.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function logAIInvocation(record: AIInvocationLogRecord): void {
  // Mechanism equivalent to persistent logging. Keeps operational logs structured
  // and avoids storing full sensitive payload content in operational logs.
  console.log(`[AIInvocationLog] ${JSON.stringify(record)}`);
}

async function callModel(
  model: string,
  payload: InvokeAIPayload,
  temperature: number
): Promise<InvokeResult> {
  return invokeLLM({
    ...payload,
    model,
    temperature: payload.temperature ?? temperature,
  });
}

export async function invokeAI(
  taskType: AITaskType,
  payload: InvokeAIPayload,
  options: InvokeAIOptions = {}
): Promise<InvokeAIResult> {
  const config = TASK_CONFIG[taskType];
  const invocationId = generateInvocationId();
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();

  const primaryModel = options.primaryModelOverride || config.primaryModel;
  const fallbackModel =
    options.fallbackModelOverride !== undefined
      ? options.fallbackModelOverride
      : config.fallbackModel;

  try {
    const primaryResponse = await callModel(primaryModel, payload, config.temperature);
    const primaryContent = extractTextContent(primaryResponse);
    const validation =
      config.requiresValidation && config.criticality === "HIGH"
        ? validateClinicalOutput(primaryContent, taskType)
        : undefined;

    if (validation && !validation.passed && fallbackModel) {
      const fallbackResponse = await callModel(
        fallbackModel,
        payload,
        config.temperature
      );
      const fallbackContent = extractTextContent(fallbackResponse);
      const fallbackValidation = validateClinicalOutput(fallbackContent, taskType);
      const fallbackLatency = Date.now() - startedAt;

      logAIInvocation({
        invocationId,
        taskType,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs: fallbackLatency,
        validationPassed: fallbackValidation.passed,
        warningsCount: fallbackValidation.issues.length,
        inferredContentCount: 0,
        consultationId: options.consultationId,
        callId: options.callId,
        leadId: options.leadId,
        createdAt,
      });

      return {
        success: true,
        taskType,
        invocationId,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs: fallbackLatency,
        response: fallbackResponse,
        warnings: fallbackValidation.issues,
        inferredContent: [],
        validation: fallbackValidation,
        createdAt,
      };
    }

    const latencyMs = Date.now() - startedAt;
    logAIInvocation({
      invocationId,
      taskType,
      model: primaryModel,
      fallbackUsed: false,
      latencyMs,
      validationPassed: validation ? validation.passed : null,
      warningsCount: validation?.issues.length ?? 0,
      inferredContentCount: 0,
      consultationId: options.consultationId,
      callId: options.callId,
      leadId: options.leadId,
      createdAt,
    });

    return {
      success: true,
      taskType,
      invocationId,
      model: primaryModel,
      fallbackUsed: false,
      latencyMs,
      response: primaryResponse,
      warnings: validation?.issues ?? [],
      inferredContent: [],
      ...(validation ? { validation } : {}),
      createdAt,
    };
  } catch (primaryError: unknown) {
    const primaryErrorMessage =
      primaryError instanceof Error ? primaryError.message : String(primaryError);

    if (!fallbackModel) {
      const latencyMs = Date.now() - startedAt;
      logAIInvocation({
        invocationId,
        taskType,
        model: primaryModel,
        fallbackUsed: false,
        latencyMs,
        validationPassed: null,
        warningsCount: 1,
        inferredContentCount: 0,
        consultationId: options.consultationId,
        callId: options.callId,
        leadId: options.leadId,
        createdAt,
      });

      return {
        success: false,
        taskType,
        invocationId,
        model: primaryModel,
        fallbackUsed: false,
        latencyMs,
        error: "Falha no modelo primário e fallback não configurado",
        primaryError: primaryErrorMessage,
        warnings: [primaryErrorMessage],
        inferredContent: [],
        createdAt,
      };
    }

    try {
      const fallbackResponse = await callModel(
        fallbackModel,
        payload,
        config.temperature
      );
      const fallbackLatency = Date.now() - startedAt;
      logAIInvocation({
        invocationId,
        taskType,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs: fallbackLatency,
        validationPassed: null,
        warningsCount: 1,
        inferredContentCount: 0,
        consultationId: options.consultationId,
        callId: options.callId,
        leadId: options.leadId,
        createdAt,
      });

      return {
        success: true,
        taskType,
        invocationId,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs: fallbackLatency,
        response: fallbackResponse,
        warnings: [primaryErrorMessage],
        inferredContent: [],
        createdAt,
      };
    } catch (fallbackError: unknown) {
      const fallbackErrorMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      const latencyMs = Date.now() - startedAt;

      logAIInvocation({
        invocationId,
        taskType,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs,
        validationPassed: null,
        warningsCount: 2,
        inferredContentCount: 0,
        consultationId: options.consultationId,
        callId: options.callId,
        leadId: options.leadId,
        createdAt,
      });

      return {
        success: false,
        taskType,
        invocationId,
        model: fallbackModel,
        fallbackUsed: true,
        latencyMs,
        error: "Todos os modelos falharam",
        primaryError: primaryErrorMessage,
        fallbackError: fallbackErrorMessage,
        warnings: [primaryErrorMessage, fallbackErrorMessage],
        inferredContent: [],
        createdAt,
      };
    }
  }
}
