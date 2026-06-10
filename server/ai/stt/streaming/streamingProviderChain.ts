/**
 * Streaming Provider Chain — Strategy Pattern
 *
 * Resolves which streaming STT provider to use based on:
 * 1. Environment configuration (CONSULTATION_STREAMING_ASR_PROVIDER)
 * 2. Provider availability (API key present, service reachable)
 * 3. Fallback chain (assemblyai → deepgram → none)
 *
 * This replaces the hard-coded AssemblyAI check in ConsultationStreamingSession.
 */
import { ENV } from "../../../_core/env";
import { createLogger } from "../../../lib/logger";
import type { StreamingProvider } from "./types";

const log = createLogger("stt:streaming:chain");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface StreamingProviderAvailability {
  provider: StreamingProvider;
  available: boolean;
  reason?: string;
}

export interface StreamingChainResult {
  provider: StreamingProvider | null;
  availableProviders: StreamingProviderAvailability[];
  fallbackUsed: boolean;
}

// --------------------------------------------------------------------------
// Provider Availability Checks
// --------------------------------------------------------------------------

function isAssemblyAIAvailable(): StreamingProviderAvailability {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return { provider: "assemblyai", available: false, reason: "ASSEMBLYAI_API_KEY not configured" };
  }
  return { provider: "assemblyai", available: true };
}

function isDeepgramStreamingAvailable(): StreamingProviderAvailability {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return { provider: "deepgram", available: false, reason: "DEEPGRAM_API_KEY not configured" };
  }
  // Deepgram streaming is not yet implemented
  return { provider: "deepgram", available: false, reason: "Deepgram streaming not yet implemented" };
}

function isOpenAIStreamingAvailable(): StreamingProviderAvailability {
  // OpenAI real-time API is not yet integrated
  return { provider: "openai", available: false, reason: "OpenAI streaming not yet implemented" };
}

// --------------------------------------------------------------------------
// Chain Resolution
// --------------------------------------------------------------------------

const PROVIDER_CHECKS: Record<StreamingProvider, () => StreamingProviderAvailability> = {
  assemblyai: isAssemblyAIAvailable,
  deepgram: isDeepgramStreamingAvailable,
  openai: isOpenAIStreamingAvailable,
};

const DEFAULT_CHAIN: StreamingProvider[] = ["assemblyai", "deepgram", "openai"];

/**
 * Resolve the best available streaming provider.
 *
 * Priority:
 * 1. If CONSULTATION_STREAMING_ASR_PROVIDER is set, try that first
 * 2. Fall through the default chain until one is available
 * 3. Return null if none are available
 */
export function resolveStreamingProvider(): StreamingChainResult {
  const preferred = (ENV.consultationStreamingAsrProvider || "").toLowerCase() as StreamingProvider;
  const availableProviders: StreamingProviderAvailability[] = [];

  // Build ordered chain: preferred first, then defaults (excluding preferred)
  const chain: StreamingProvider[] = [];
  if (preferred && PROVIDER_CHECKS[preferred]) {
    chain.push(preferred);
  }
  for (const p of DEFAULT_CHAIN) {
    if (!chain.includes(p)) chain.push(p);
  }

  let selectedProvider: StreamingProvider | null = null;
  let fallbackUsed = false;

  for (const providerName of chain) {
    const check = PROVIDER_CHECKS[providerName];
    if (!check) continue;

    const status = check();
    availableProviders.push(status);

    if (status.available && !selectedProvider) {
      selectedProvider = providerName;
      // If the selected provider is not the preferred one, it's a fallback
      if (preferred && providerName !== preferred) {
        fallbackUsed = true;
      }
    }
  }

  if (selectedProvider) {
    log.info("Streaming provider resolved", {
      selected: selectedProvider,
      fallbackUsed,
      preferred: preferred || "none",
    });
  } else {
    log.warn("No streaming provider available", {
      preferred: preferred || "none",
      checks: availableProviders.map((p) => `${p.provider}:${p.reason || "ok"}`),
    });
  }

  return { provider: selectedProvider, availableProviders, fallbackUsed };
}

/**
 * Quick check: is any streaming provider available?
 */
export function isStreamingAvailable(): boolean {
  const result = resolveStreamingProvider();
  return result.provider !== null;
}
