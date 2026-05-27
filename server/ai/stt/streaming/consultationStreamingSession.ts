import { nanoid } from "nanoid";
import { ENV } from "../../../_core/env";
import { getConsultationStreamingStatus } from "../../../helpers/consultationStreamingAvailability";
import { AssemblyAIStreamingProvider } from "./providers/assemblyAIStreamingProvider";
import type {
  ConsultationStreamingProvider,
  ProviderCallbacks,
  StreamingProvider,
  StreamingTranscriptEvent,
} from "./types";

type SessionOptions = {
  consultationId: number;
  provider: StreamingProvider;
  sendToClient: (event: StreamingTranscriptEvent) => void;
};

export class ConsultationStreamingSession {
  private readonly sessionId: string;
  private readonly consultationId: number;
  private readonly providerKind: StreamingProvider;
  private readonly sendToClient: (event: StreamingTranscriptEvent) => void;
  private provider: ConsultationStreamingProvider | null = null;
  private readonly startedAt: string;
  private endedAt: string | null = null;
  private packetsSent = 0;
  private finalTurns = 0;
  private closedByProvider = false;
  private closed = false;

  private get currentTurnId(): string {
    return `turn_${this.finalTurns + 1}`;
  }

  constructor(options: SessionOptions) {
    this.sessionId = `live_${nanoid(10)}`;
    this.consultationId = options.consultationId;
    this.providerKind = options.provider;
    this.sendToClient = options.sendToClient;
    this.startedAt = new Date().toISOString();
  }

  private emit(
    event: Omit<StreamingTranscriptEvent, "sessionId" | "consultationId" | "createdAt">
  ): void {
    this.sendToClient({
      sessionId: this.sessionId,
      consultationId: this.consultationId,
      createdAt: new Date().toISOString(),
      ...event,
    });
  }

  private buildProviderCallbacks(): ProviderCallbacks {
    return {
      onPartial: ({ text, speakerLabel, startMs, endMs, confidence }) => {
        this.emit({
          type: "partial",
          turnId: this.currentTurnId,
          text,
          isFinal: false,
          speakerLabel: speakerLabel ?? null,
          speakerRole: "UNKNOWN",
          startMs: startMs ?? null,
          endMs: endMs ?? null,
          confidence: confidence ?? null,
          provider: this.providerKind,
          model: this.provider?.model ?? "unknown",
        });
      },
      onFinal: ({ text, speakerLabel, startMs, endMs, confidence }) => {
        this.finalTurns += 1;
        this.emit({
          type: "final",
          turnId: `turn_${this.finalTurns}`,
          text,
          isFinal: true,
          speakerLabel: speakerLabel ?? null,
          speakerRole: "UNKNOWN",
          startMs: startMs ?? null,
          endMs: endMs ?? null,
          confidence: confidence ?? null,
          provider: this.providerKind,
          model: this.provider?.model ?? "unknown",
        });
      },
      onError: (message) => {
        this.emit({
          type: "error",
          error: message,
          provider: this.providerKind,
          model: this.provider?.model ?? "unknown",
        });
      },
      onClose: () => {
        this.closedByProvider = true;
        this.endedAt = new Date().toISOString();
        this.emit({
          type: "integrity",
          provider: this.providerKind,
          model: this.provider?.model ?? "unknown",
          integrity: {
            audioPacketsSent: this.packetsSent,
            finalTurnsReceived: this.finalTurns,
            providerClosed: true,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
          },
        });
        this.emit({
          type: "session_closed",
          provider: this.providerKind,
          model: this.provider?.model ?? "unknown",
        });
      },
    };
  }

  private createProvider(): ConsultationStreamingProvider {
    if (this.providerKind !== "assemblyai") {
      throw new Error(
        `Provider ${this.providerKind} ainda não implementado para consulta streaming`
      );
    }
    const streamingStatus = getConsultationStreamingStatus();
    if (!streamingStatus.ready) {
      throw new Error(
        streamingStatus.reason ||
          "Streaming de consulta indisponível no momento."
      );
    }
    return new AssemblyAIStreamingProvider(this.buildProviderCallbacks(), {
      model: ENV.consultationStreamingAssemblyAIModel as
        | "u3-rt-pro"
        | "universal-streaming-multilingual",
      sampleRate: ENV.consultationStreamingSampleRate,
      tokenExpiresSeconds: ENV.consultationStreamingTokenExpiresSeconds,
      maxSessionDurationSeconds: ENV.consultationStreamingMaxSessionSeconds,
    });
  }

  public async start(): Promise<void> {
    this.provider = this.createProvider();
    await this.provider.start();
    this.emit({
      type: "session_started",
      provider: this.providerKind,
      model: this.provider.model,
    });
  }

  public sendAudio(chunk: Buffer): void {
    if (!this.provider) return;
    this.packetsSent += 1;
    this.provider.sendAudioPcm(chunk);
  }

  public stop(): void {
    if (!this.provider) return;
    this.provider.stop();
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (!this.provider) return;
    this.provider.close();
    if (!this.closedByProvider) {
      this.endedAt = new Date().toISOString();
      this.emit({
        type: "integrity",
        provider: this.providerKind,
        model: this.provider.model,
        integrity: {
          audioPacketsSent: this.packetsSent,
          finalTurnsReceived: this.finalTurns,
          providerClosed: false,
          startedAt: this.startedAt,
          endedAt: this.endedAt,
        },
      });
      this.emit({
        type: "session_closed",
        provider: this.providerKind,
        model: this.provider.model,
      });
    }
  }
}
