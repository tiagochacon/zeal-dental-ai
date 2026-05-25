import { EXTENDED_HALLUCINATION_MARKERS } from "./antiHallucination";

export const CONSERVATIVE_DENTAL_PROMPT =
  "Transcreva em português brasileiro apenas as falas audíveis desta consulta odontológica. Preserve termos clínicos quando estiverem audíveis. Não invente palavras, frases, falantes, diagnósticos ou informações ausentes. Se houver silêncio ou trecho inaudível, retorne vazio para esse trecho.";

export type WhisperSegmentLocal = {
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  text?: string;
};

export type HallucinationResult = {
  isHallucination: boolean;
  reason: string;
};

const RECOVERABLE_WHISPER_ERROR_PATTERNS = [
  "could not be decoded",
  "format is not supported",
  "invalid file format",
  "invalid audio",
  "failed to read",
  "error while decoding",
  "invalid data found when processing input",
];

export function resolveAudioExtensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("flac")) return "flac";
  return "webm";
}

export function buildConservativeChunkPrompt(previousContext: string): string {
  const trimmedContext = previousContext.trim();
  if (!trimmedContext) {
    return CONSERVATIVE_DENTAL_PROMPT;
  }

  return `${CONSERVATIVE_DENTAL_PROMPT}\nContexto do trecho anterior (apenas para continuidade, não retranscreva literalmente): ${trimmedContext}`;
}

export function detectChunkHallucination(
  transcript: string,
  segments: WhisperSegmentLocal[]
): HallucinationResult {
  const cleanTranscript = transcript.trim();
  const normalizedTranscript = cleanTranscript.toLowerCase();

  if (!cleanTranscript) {
    return { isHallucination: false, reason: "" };
  }

  if (segments.length > 0) {
    const noSpeechValues = segments
      .map((seg) => seg.no_speech_prob)
      .filter((value): value is number => typeof value === "number");
    const avgLogprobValues = segments
      .map((seg) => seg.avg_logprob)
      .filter((value): value is number => typeof value === "number");
    const compressionValues = segments
      .map((seg) => seg.compression_ratio)
      .filter((value): value is number => typeof value === "number");

    const avgNoSpeechProb = noSpeechValues.length
      ? noSpeechValues.reduce((sum, value) => sum + value, 0) / noSpeechValues.length
      : 0;
    const avgLogProb = avgLogprobValues.length
      ? avgLogprobValues.reduce((sum, value) => sum + value, 0) / avgLogprobValues.length
      : 0;
    const avgCompression = compressionValues.length
      ? compressionValues.reduce((sum, value) => sum + value, 0) / compressionValues.length
      : 0;

    if (avgNoSpeechProb > 0.85) {
      return {
        isHallucination: true,
        reason: `silêncio (no_speech_prob=${avgNoSpeechProb.toFixed(2)})`,
      };
    }

    if (avgLogProb < -1.1 && avgNoSpeechProb > 0.5) {
      return {
        isHallucination: true,
        reason: `baixa confiança acústica (avg_logprob=${avgLogProb.toFixed(2)})`,
      };
    }

    if (avgCompression > 2.5 && cleanTranscript.length < 250) {
      return {
        isHallucination: true,
        reason: `compressão suspeita (compression_ratio=${avgCompression.toFixed(2)})`,
      };
    }
  }

  if (
    cleanTranscript.length < 450 &&
    EXTENDED_HALLUCINATION_MARKERS.some((marker) =>
      normalizedTranscript.includes(marker)
    )
  ) {
    return {
      isHallucination: true,
      reason: "marcador conhecido de alucinação/prompt",
    };
  }

  return { isHallucination: false, reason: "" };
}

export function isRecoverableWhisperChunkError(
  statusCode: number,
  errorBody: string,
  durationSeconds?: number
): boolean {
  const normalizedBody = (errorBody || "").toLowerCase();

  const hasRecoverablePattern = RECOVERABLE_WHISPER_ERROR_PATTERNS.some((pattern) =>
    normalizedBody.includes(pattern)
  );
  if (hasRecoverablePattern) {
    return true;
  }

  const isClientFormatLikeError = statusCode === 400 || statusCode === 415 || statusCode === 422;
  if (isClientFormatLikeError && typeof durationSeconds === "number" && durationSeconds <= 8) {
    return true;
  }

  return false;
}
