import type { StreamingProvider } from "../ai/stt/streaming/types";

export type ConsultationStreamingStatus = {
  enabled: boolean;
  ready: boolean;
  provider: StreamingProvider;
  reason: string | null;
};

function readBooleanEnv(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (!raw || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function providerCredentialsReady(provider: StreamingProvider): string | null {
  if (provider === "assemblyai") {
    if (!(process.env.ASSEMBLYAI_API_KEY || "").trim()) {
      return "ASSEMBLYAI_API_KEY não configurada no backend.";
    }
    return null;
  }
  if (provider === "deepgram") {
    if (!(process.env.DEEPGRAM_API_KEY || "").trim()) {
      return "DEEPGRAM_API_KEY não configurada no backend.";
    }
    return null;
  }
  if (provider === "openai") {
    if (!(process.env.OPENAI_API_KEY || "").trim()) {
      return "OPENAI_API_KEY não configurada no backend.";
    }
    return null;
  }
  return `Provider de streaming desconhecido: ${provider}`;
}

export function getConsultationStreamingStatus(): ConsultationStreamingStatus {
  const provider = (process.env.CONSULTATION_STREAMING_ASR_PROVIDER ||
    "assemblyai") as StreamingProvider;
  const enabled = readBooleanEnv("CONSULTATION_STREAMING_ASR_ENABLED", true);

  if (!enabled) {
    return {
      enabled: false,
      ready: false,
      provider,
      reason: "Streaming de consulta desabilitado por configuração.",
    };
  }

  const credentialReason = providerCredentialsReady(provider);
  if (credentialReason) {
    return {
      enabled: true,
      ready: false,
      provider,
      reason: credentialReason,
    };
  }

  if (provider !== "assemblyai") {
    return {
      enabled: true,
      ready: false,
      provider,
      reason: `Provider ${provider} ainda não implementado para streaming de consulta.`,
    };
  }

  return {
    enabled: true,
    ready: true,
    provider,
    reason: null,
  };
}
