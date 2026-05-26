import type { TranscribeInput } from "./types";

export function canUseDeepgram(): boolean {
  return process.env.STT_ENABLE_DEEPGRAM === "true" && !!process.env.DEEPGRAM_API_KEY;
}

export function canUseOpenAITranscribe(): boolean {
  return (
    process.env.STT_ENABLE_OPENAI_TRANSCRIBE === "true" && !!process.env.OPENAI_API_KEY
  );
}

function shouldUseOpenAIForGeneral(input: TranscribeInput): boolean {
  return (
    (input.audioType === "call" || input.audioType === "whatsapp") &&
    canUseOpenAITranscribe()
  );
}

export function resolveProviderChain(input: TranscribeInput): string[] {
  if (input.providerOverride) {
    return [input.providerOverride, "whisper"];
  }

  if (input.audioType === "progressive_chunk") {
    return ["whisper"];
  }

  if (input.audioType === "consultation") {
    const chain: string[] = [];
    if (canUseDeepgram()) chain.push("deepgram");
    if (canUseOpenAITranscribe()) chain.push("openai");
    chain.push("whisper");
    return chain;
  }

  if (shouldUseOpenAIForGeneral(input)) {
    return ["openai", "whisper"];
  }

  return ["whisper"];
}
