import { ENV } from "../../../_core/env";
import type { SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../types";
import { resolveAudioExtensionForMimeType } from "../../../helpers/chunkTranscription";

type WhisperSegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
};

function ensureAudioBuffer(input: TranscribeInput): Buffer {
  if (input.audioBuffer) return input.audioBuffer;
  throw new Error("WhisperProvider requires audioBuffer");
}

function mapAvgLogprobToConfidence(avgLogprob?: number): number | null {
  if (typeof avgLogprob !== "number") return null;
  const normalized = Math.max(0, Math.min(1, (avgLogprob + 2) / 2));
  return Number(normalized.toFixed(3));
}

function createSegmentId(prefix: string, index: number): string {
  return `${prefix}-seg-${index + 1}`;
}

export class WhisperProvider implements SpeechToTextProvider {
  public readonly id = "whisper";
  public readonly supportsDiarization = false;

  public async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      throw new Error("Forge API not configured");
    }

    const audioBuffer = ensureAudioBuffer(input);
    const ext = resolveAudioExtensionForMimeType(input.mimeType);
    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;
    const endpoint = new URL("v1/audio/transcriptions", baseUrl).toString();

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(audioBuffer)], { type: input.mimeType }),
      `audio.${ext}`
    );
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("language", input.language ?? "pt");
    if (input.prompt) {
      formData.append("prompt", input.prompt);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Whisper request failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as {
      text?: string;
      segments?: WhisperSegment[];
      language?: string;
    };

    const segments = (payload.segments ?? []).map((seg, index) => {
      const confidence = mapAvgLogprobToConfidence(seg.avg_logprob);
      return {
        id: createSegmentId("whisper", index),
        speakerLabel: null,
        speakerRole: "UNKNOWN" as const,
        start: typeof seg.start === "number" ? seg.start : null,
        end: typeof seg.end === "number" ? seg.end : null,
        text: (seg.text ?? "").trim(),
        confidence,
        flagged: confidence !== null ? confidence < 0.75 : false,
      };
    });

    const transcript = (payload.text ?? "").trim();
    const warnings: string[] = [];
    if (input.enableDiarization) {
      warnings.push("Diarização não disponível no provider Whisper.");
    }
    if (segments.some((segment) => segment.flagged)) {
      warnings.push("Há segmentos com confiança baixa na transcrição.");
    }

    return {
      transcript,
      segments,
      provider: "whisper",
      model: "whisper-1",
      fallbackUsed: false,
      warnings,
      rawProviderMetadata: {
        language: payload.language ?? input.language ?? "pt",
      },
    };
  }
}
