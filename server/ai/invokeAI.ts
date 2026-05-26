import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";
import { TASK_CONFIG, type AITaskType } from "./taskConfig";
import { validateByProfile, type AIValidationResult } from "./validators";

export type AIInvocationLogRecord = {
  invocationId: string;
  taskType: AITaskType;
  model: string;
  fallbackUsed: boolean;
  retries: number;
  latencyMs: number;
  confidence: number;
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
  maxRetriesOverride?: number;
};

export type InvokeAIPayload = Omit<InvokeParams, "model">;

export type InvokeAIResult =
  | {
      success: true;
      taskType: AITaskType;
      invocationId: string;
      model: string;
      fallbackUsed: boolean;
      retries: number;
      latencyMs: number;
      confidence: number;
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
      retries: number;
      latencyMs: number;
      confidence: number;
      error: string;
      primaryError?: string;
      fallbackError?: string;
      warnings: string[];
      inferredContent: string[];
      validation?: AIValidationResult;
      createdAt: string;
    };

function generateInvocationId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const validateClinicalOutput = (
  rawContent: string,
  taskType: AITaskType
): AIValidationResult => validateByProfile(rawContent, TASK_CONFIG[taskType].validationProfile);

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

function computeOperationalConfidence(params: {
  criticality: "HIGH" | "MEDIUM" | "LOW";
  retries: number;
  fallbackUsed: boolean;
  validation?: AIValidationResult;
}): number {
  const baseByCriticality = {
    HIGH: 0.9,
    MEDIUM: 0.82,
    LOW: 0.75,
  } as const;
  let score = baseByCriticality[params.criticality];
  if (params.retries > 0) score -= Math.min(0.2, params.retries * 0.08);
  if (params.fallbackUsed) score -= 0.1;
  if (params.validation && !params.validation.passed) score -= 0.2;
  return Number(Math.max(0.1, Math.min(0.99, score)).toFixed(2));
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

async function callModelWithRetry(
  model: string,
  payload: InvokeAIPayload,
  temperature: number,
  maxRetries: number
): Promise<{ response: InvokeResult; retries: number }> {
  let retries = 0;
  let lastError: unknown = null;
  while (retries <= maxRetries) {
    try {
      const response = await callModel(model, payload, temperature);
      return { response, retries };
    } catch (error) {
      lastError = error;
      if (retries >= maxRetries) break;
      retries += 1;
    }
  }
  throw lastError;
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
  const maxRetries =
    typeof options.maxRetriesOverride === "number"
      ? options.maxRetriesOverride
      : config.maxRetries;

  try {
    const primaryRun = await callModelWithRetry(
      primaryModel,
      payload,
      config.temperature,
      maxRetries
    );
    const primaryResponse = primaryRun.response;
    const primaryContent = extractTextContent(primaryResponse);
    const validation = validateByProfile(primaryContent, config.validationProfile);

    if (validation && !validation.passed && fallbackModel) {
      const fallbackRun = await callModelWithRetry(
        fallbackModel,
        payload,
        config.temperature,
        maxRetries
      );
      const fallbackResponse = fallbackRun.response;
      const fallbackContent = extractTextContent(fallbackResponse);
      const fallbackValidation = validateByProfile(
        fallbackContent,
        config.validationProfile
      );
      const fallbackLatency = Date.now() - startedAt;
      const confidence = computeOperationalConfidence({
        criticality: config.criticality,
        retries: primaryRun.retries + fallbackRun.retries,
        fallbackUsed: true,
        validation: fallbackValidation,
      });

      logAIInvocation({
        invocationId,
        taskType,
        model: fallbackModel,
        fallbackUsed: true,
        retries: primaryRun.retries + fallbackRun.retries,
        latencyMs: fallbackLatency,
        confidence,
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
        retries: primaryRun.retries + fallbackRun.retries,
        latencyMs: fallbackLatency,
        confidence,
        response: fallbackResponse,
        warnings: fallbackValidation.issues,
        inferredContent: [],
        validation: fallbackValidation,
        createdAt,
      };
    }

    const latencyMs = Date.now() - startedAt;
    const confidence = computeOperationalConfidence({
      criticality: config.criticality,
      retries: primaryRun.retries,
      fallbackUsed: false,
      validation,
    });
    logAIInvocation({
      invocationId,
      taskType,
      model: primaryModel,
      fallbackUsed: false,
      retries: primaryRun.retries,
      latencyMs,
      confidence,
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
      retries: primaryRun.retries,
      latencyMs,
      confidence,
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
        retries: 0,
        latencyMs,
        confidence: computeOperationalConfidence({
          criticality: config.criticality,
          retries: 0,
          fallbackUsed: false,
        }),
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
        retries: 0,
        latencyMs,
        confidence: computeOperationalConfidence({
          criticality: config.criticality,
          retries: 0,
          fallbackUsed: false,
        }),
        error: "Falha no modelo primário e fallback não configurado",
        primaryError: primaryErrorMessage,
        warnings: [primaryErrorMessage],
        inferredContent: [],
        createdAt,
      };
    }

    try {
      const fallbackRun = await callModelWithRetry(
        fallbackModel,
        payload,
        config.temperature,
        maxRetries
      );
      const fallbackResponse = fallbackRun.response;
      const fallbackLatency = Date.now() - startedAt;
      const confidence = computeOperationalConfidence({
        criticality: config.criticality,
        retries: fallbackRun.retries,
        fallbackUsed: true,
      });
      logAIInvocation({
        invocationId,
        taskType,
        model: fallbackModel,
        fallbackUsed: true,
        retries: fallbackRun.retries,
        latencyMs: fallbackLatency,
        confidence,
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
        retries: fallbackRun.retries,
        latencyMs: fallbackLatency,
        confidence,
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
        retries: maxRetries + 1,
        latencyMs,
        confidence: computeOperationalConfidence({
          criticality: config.criticality,
          retries: maxRetries + 1,
          fallbackUsed: true,
        }),
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
        retries: maxRetries + 1,
        latencyMs,
        confidence: computeOperationalConfidence({
          criticality: config.criticality,
          retries: maxRetries + 1,
          fallbackUsed: true,
        }),
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
