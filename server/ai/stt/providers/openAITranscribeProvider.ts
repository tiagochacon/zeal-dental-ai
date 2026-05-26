import type { SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../types";
import { resolveAudioExtensionForMimeType } from "../../../helpers/chunkTranscription";

type OpenAISegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
};

function confidenceFromAvgLogprob(value?: number): number | null {
  if (typeof value !== "number") return null;
  const normalized = Math.max(0, Math.min(1, (value + 2) / 2));
  return Number(normalized.toFixed(3));
}

function createSegmentId(index: number): string {
  return `openai-seg-${index + 1}`;
}

function assertOpenAIAudioBuffer(input: TranscribeInput): Buffer {
  if (input.audioBuffer) return input.audioBuffer;
  throw new Error("OpenAITranscribeProvider requires audioBuffer");
}

export class OpenAITranscribeProvider implements SpeechToTextProvider {
  public readonly id = "openai-transcribe";
  public readonly supportsDiarization = false;

  public async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const model = input.audioType === "call" || input.audioType === "whatsapp"
      ? "gpt-4o-mini-transcribe"
      : "gpt-4o-transcribe";

    const endpoint =
      process.env.OPENAI_AUDIO_TRANSCRIBE_URL ||
      "https://api.openai.com/v1/audio/transcriptions";

    const audioBuffer = assertOpenAIAudioBuffer(input);
    const ext = resolveAudioExtensionForMimeType(input.mimeType);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(audioBuffer)], { type: input.mimeType }),
      `audio.${ext}`
    );
    formData.append("model", model);
    formData.append("response_format", "verbose_json");
    formData.append("language", input.language ?? "pt");
    if (input.prompt) formData.append("prompt", input.prompt);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI transcription failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      segments?: OpenAISegment[];
    };
    const segments = (payload.segments ?? []).map((segment, index) => {
      const confidence = confidenceFromAvgLogprob(segment.avg_logprob);
      return {
        id: createSegmentId(index),
        speakerLabel: null,
        speakerRole: "UNKNOWN" as const,
        start: typeof segment.start === "number" ? segment.start : null,
        end: typeof segment.end === "number" ? segment.end : null,
        text: (segment.text ?? "").trim(),
        confidence,
        flagged: confidence !== null ? confidence < 0.75 : false,
      };
    });

    const warnings: string[] = [];
    if (input.enableDiarization) {
      warnings.push("Diarização indisponível no provider OpenAI transcribe.");
    }

    return {
      transcript: (payload.text ?? "").trim(),
      segments,
      provider: "openai",
      model,
      fallbackUsed: false,
      warnings,
      rawProviderMetadata: {
        language: payload.language ?? input.language ?? "pt",
      },
    };
  }
}
