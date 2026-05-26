import { CONSERVATIVE_DENTAL_PROMPT } from "../../helpers/chunkTranscription";
import { DeepgramProvider } from "./providers/deepgramProvider";
import { OpenAITranscribeProvider } from "./providers/openAITranscribeProvider";
import { WhisperProvider } from "./providers/whisperProvider";
import type {
  SpeechToTextProvider,
  TranscribeInput,
  TranscribeResult,
} from "./types";

const DENTAL_VOCABULARY_PT_BR = [
  "bruxismo",
  "ATM",
  "periodontite",
  "endodontia",
  "gengivite",
  "oclusão",
  "retratamento",
  "implante",
  "prótese",
  "canal",
  "exodontia",
  "clareamento",
  "faceta",
  "Invisalign",
  "aparelho",
  "contenção",
  "radiografia",
  "tomografia",
  "cirurgia",
  "anestesia",
  "lidocaína",
  "articaína",
  "profilaxia",
  "raspagem",
  "curetagem",
  "enxerto",
];

const providers: Record<string, SpeechToTextProvider> = {
  whisper: new WhisperProvider(),
  openai: new OpenAITranscribeProvider(),
  deepgram: new DeepgramProvider(),
};

function canUseDeepgram(): boolean {
  return process.env.STT_ENABLE_DEEPGRAM === "true" && !!process.env.DEEPGRAM_API_KEY;
}

function canUseOpenAITranscribe(): boolean {
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

function resolveProviderChain(input: TranscribeInput): string[] {
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

function withDefaults(input: TranscribeInput): TranscribeInput {
  return {
    ...input,
    language: input.language ?? (input.audioType === "consultation" ? "pt-BR" : "pt"),
    enableDiarization:
      input.enableDiarization ??
      (input.audioType === "consultation" || input.audioType === "call"),
    vocabulary:
      input.audioType === "consultation"
        ? [...DENTAL_VOCABULARY_PT_BR, ...(input.vocabulary ?? [])]
        : input.vocabulary,
    prompt: input.prompt ?? CONSERVATIVE_DENTAL_PROMPT,
  };
}

function ensureUnknownSpeakerRole(result: TranscribeResult): TranscribeResult {
  return {
    ...result,
    segments: result.segments.map((segment) => ({
      ...segment,
      speakerRole: "UNKNOWN",
    })),
  };
}

export async function transcribeAudio(
  input: TranscribeInput
): Promise<TranscribeResult> {
  const normalizedInput = withDefaults(input);
  const chain = resolveProviderChain(normalizedInput);
  const warnings: string[] = [];
  let firstError: string | null = null;

  for (let index = 0; index < chain.length; index++) {
    const providerId = chain[index];
    const provider = providers[providerId];
    if (!provider) {
      warnings.push(`Provider desconhecido ignorado: ${providerId}`);
      continue;
    }

    try {
      const result = await provider.transcribe(normalizedInput);
      const fallbackUsed = index > 0;
      const mergedWarnings = [...warnings, ...result.warnings];

      if (normalizedInput.enableDiarization && !provider.supportsDiarization) {
        mergedWarnings.push(
          `Diarização ausente no provider ${provider.id}; segmentos marcados como UNKNOWN.`
        );
      }

      return ensureUnknownSpeakerRole({
        ...result,
        fallbackUsed,
        warnings: mergedWarnings,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!firstError) firstError = message;
      warnings.push(`Provider ${providerId} falhou: ${message}`);
    }
  }

  throw new Error(
    `Falha na transcrição para audioType=${normalizedInput.audioType}. ${firstError ?? "sem detalhes"}`
  );
}
