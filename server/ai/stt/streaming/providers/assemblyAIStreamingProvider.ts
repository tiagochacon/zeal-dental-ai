import { ENV } from "../../../../_core/env";
import { ASSEMBLYAI_STREAMING_KEYTERMS } from "@shared/dentalVocabulary";
import {
  buildAssemblyAITokenRequestUrl,
  formatAssemblyAITokenError,
} from "../assemblyAIToken";
import { isAssemblyAITurnFinal } from "../assemblyAITurnClassification";
import type {
  ConsultationStreamingProvider,
  ProviderCallbacks,
} from "../types";

type AssemblyTurnWord = {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
  speaker?: string | number;
};

type AssemblyTurnEvent = {
  type?: string;
  transcript?: string;
  text?: string;
  turn_is_formatted?: boolean;
  end_of_turn?: boolean;
  speaker_label?: string;
  confidence?: number;
  words?: AssemblyTurnWord[];
  message?: string;
  error?: string;
};

function normalizeSpeakerLabel(event: AssemblyTurnEvent): string | null {
  if (typeof event.speaker_label === "string") return event.speaker_label;
  const wordSpeaker = event.words?.find((word) => word.speaker !== undefined)?.speaker;
  if (typeof wordSpeaker === "string") return wordSpeaker;
  if (typeof wordSpeaker === "number") return `speaker_${wordSpeaker}`;
  return null;
}

function normalizeTiming(event: AssemblyTurnEvent): {
  startMs: number | null;
  endMs: number | null;
} {
  const starts = (event.words || [])
    .map((word) => word.start)
    .filter((value): value is number => typeof value === "number");
  const ends = (event.words || [])
    .map((word) => word.end)
    .filter((value): value is number => typeof value === "number");
  return {
    startMs: starts.length > 0 ? Math.min(...starts) : null,
    endMs: ends.length > 0 ? Math.max(...ends) : null,
  };
}

function normalizeConfidence(event: AssemblyTurnEvent): number | null {
  if (typeof event.confidence === "number") return event.confidence;
  const values = (event.words || [])
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(3));
}

export class AssemblyAIStreamingProvider implements ConsultationStreamingProvider {
  public readonly provider = "assemblyai" as const;
  public readonly model: string;

  private socket: WebSocket | null = null;
  private readonly callbacks: ProviderCallbacks;
  private readonly apiKey: string;
  private readonly sampleRate: number;
  private readonly tokenExpiresSeconds: number;
  private readonly maxSessionDurationSeconds: number;

  constructor(
    callbacks: ProviderCallbacks,
    options?: {
      model?: "u3-rt-pro" | "universal-streaming-multilingual";
      sampleRate?: number;
      tokenExpiresSeconds?: number;
      maxSessionDurationSeconds?: number;
    }
  ) {
    this.callbacks = callbacks;
    this.apiKey = process.env.ASSEMBLYAI_API_KEY || "";
    this.model = options?.model || "universal-streaming-multilingual";
    this.sampleRate = options?.sampleRate || 16000;
    this.tokenExpiresSeconds = options?.tokenExpiresSeconds ?? 600;
    this.maxSessionDurationSeconds = options?.maxSessionDurationSeconds ?? 3600;
  }

  private async createStreamingToken(): Promise<string> {
    const tokenUrl = buildAssemblyAITokenRequestUrl({
      expiresInSeconds: this.tokenExpiresSeconds,
      maxSessionDurationSeconds: this.maxSessionDurationSeconds,
    });

    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        Authorization: this.apiKey,
      },
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(
        `[AssemblyAIStreaming] Token request failed (${response.status}): ${details}`
      );
      throw new Error(
        formatAssemblyAITokenError(
          response.status,
          details,
          ENV.isProduction
        )
      );
    }

    const body = (await response.json().catch(() => null)) as
      | { token?: string }
      | null;
    const token = body?.token?.trim();
    if (!token) {
      throw new Error("AssemblyAI não retornou token temporário válido");
    }
    return token;
  }

  public async start(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("ASSEMBLYAI_API_KEY não configurada");
    }

    const ephemeralToken = await this.createStreamingToken();
    // Live streaming: keyterms odontológicos (batch/chunks usam CONSERVATIVE_DENTAL_PROMPT separadamente).
    const endpoint = new URL("wss://streaming.assemblyai.com/v3/ws");
    endpoint.searchParams.set("sample_rate", String(this.sampleRate));
    endpoint.searchParams.set("speech_model", this.model);
    endpoint.searchParams.set("speaker_labels", "true");
    endpoint.searchParams.set("format_turns", "true");
    endpoint.searchParams.set(
      "keyterms_prompt",
      JSON.stringify(ASSEMBLYAI_STREAMING_KEYTERMS)
    );
    endpoint.searchParams.set("token", ephemeralToken);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(endpoint.toString());
      this.socket = ws;

      ws.onopen = () => resolve();

      ws.onmessage = (message) => {
        try {
          const text = typeof message.data === "string"
            ? message.data
            : Buffer.from(message.data as ArrayBuffer).toString("utf-8");
          const parsed = JSON.parse(text) as AssemblyTurnEvent;
          const eventType = parsed.type || "";

          if (eventType.toLowerCase().includes("error")) {
            this.callbacks.onError(parsed.error || parsed.message || "Erro de streaming AssemblyAI");
            return;
          }

          if (eventType === "Turn" || parsed.transcript || parsed.text) {
            const transcript = (parsed.transcript || parsed.text || "").trim();
            if (!transcript) return;
            const { startMs, endMs } = normalizeTiming(parsed);
            const confidence = normalizeConfidence(parsed);
            const speakerLabel = normalizeSpeakerLabel(parsed);

            if (!ENV.isProduction) {
              console.debug("[AssemblyAIStreaming] Turn", {
                end_of_turn: parsed.end_of_turn,
                turn_is_formatted: parsed.turn_is_formatted,
                transcriptPreview: transcript.slice(0, 80),
              });
            }

            // Only end_of_turn marks a completed turn; turn_is_formatted can be true on partials.
            if (isAssemblyAITurnFinal(parsed)) {
              this.callbacks.onFinal({
                text: transcript,
                speakerLabel,
                startMs,
                endMs,
                confidence,
              });
            } else {
              this.callbacks.onPartial({
                text: transcript,
                speakerLabel,
                startMs,
                endMs,
                confidence,
              });
            }
          }
        } catch (error) {
          this.callbacks.onError(
            error instanceof Error ? error.message : "Falha ao processar evento do AssemblyAI"
          );
        }
      };

      ws.onerror = () => {
        reject(new Error("Falha ao conectar no AssemblyAI Streaming"));
      };

      ws.onclose = () => {
        this.callbacks.onClose();
      };
    });
  }

  public sendAudioPcm(chunk: Buffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(chunk);
  }

  public stop(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "Terminate" }));
  }

  public close(): void {
    if (!this.socket) return;
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      return;
    }
    this.socket = null;
  }
}
