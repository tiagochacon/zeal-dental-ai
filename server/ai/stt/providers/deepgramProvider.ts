import type { SpeechToTextProvider, TranscribeInput, TranscribeResult } from "../types";

type DeepgramWord = {
  confidence?: number;
};

type DeepgramUtterance = {
  start?: number;
  end?: number;
  transcript?: string;
  confidence?: number;
  speaker?: number;
  words?: DeepgramWord[];
};

type DeepgramResponse = {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
};

function averageWordConfidence(words?: DeepgramWord[]): number | null {
  if (!words || words.length === 0) return null;
  const values = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(avg.toFixed(3));
}

function createSegmentId(index: number): string {
  return `deepgram-seg-${index + 1}`;
}

function assertDeepgramBuffer(input: TranscribeInput): Buffer {
  if (input.audioBuffer) return input.audioBuffer;
  throw new Error("DeepgramProvider requires audioBuffer");
}

export class DeepgramProvider implements SpeechToTextProvider {
  public readonly id = "deepgram";
  public readonly supportsDiarization = true;

  public async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY não configurada");
    }

    const endpoint = new URL("https://api.deepgram.com/v1/listen");
    endpoint.searchParams.set("model", "nova-3-medical");
    endpoint.searchParams.set("language", input.language ?? "pt-BR");
    endpoint.searchParams.set("diarize", input.enableDiarization ? "true" : "false");
    endpoint.searchParams.set("punctuate", "true");
    endpoint.searchParams.set("smart_format", "true");
    endpoint.searchParams.set("utterances", "true");
    endpoint.searchParams.set("filler_words", "false");
    if (input.vocabulary && input.vocabulary.length > 0) {
      endpoint.searchParams.set("keywords", input.vocabulary.slice(0, 100).join(","));
    }

    const buffer = assertDeepgramBuffer(input);
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": input.mimeType,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Deepgram transcription failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as DeepgramResponse;
    const utterances = payload.results?.utterances ?? [];
    const transcript =
      utterances.map((utterance) => utterance.transcript ?? "").join(" ").trim() ||
      payload.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ||
      "";

    const segments = utterances.map((utterance, index) => {
      const confidence =
        typeof utterance.confidence === "number"
          ? Number(utterance.confidence.toFixed(3))
          : averageWordConfidence(utterance.words);
      return {
        id: createSegmentId(index),
        speakerLabel:
          typeof utterance.speaker === "number" ? `speaker_${utterance.speaker}` : null,
        speakerRole: "UNKNOWN" as const,
        start: typeof utterance.start === "number" ? utterance.start : null,
        end: typeof utterance.end === "number" ? utterance.end : null,
        text: (utterance.transcript ?? "").trim(),
        confidence,
        flagged: confidence !== null ? confidence < 0.75 : false,
      };
    });

    const warnings: string[] = [];
    if (!input.enableDiarization) {
      warnings.push("Diarização desativada para esta transcrição.");
    }
    if (segments.some((segment) => segment.flagged)) {
      warnings.push("Há segmentos com confiança abaixo de 0.75.");
    }

    return {
      transcript,
      segments,
      provider: "deepgram",
      model: "nova-3-medical",
      fallbackUsed: false,
      warnings,
      rawProviderMetadata: payload as unknown as Record<string, unknown>,
    };
  }
}
