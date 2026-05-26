export type StreamingProvider = "assemblyai" | "deepgram" | "openai";

export type StreamingTranscriptEvent = {
  type:
    | "partial"
    | "final"
    | "error"
    | "session_started"
    | "session_closed"
    | "integrity";
  sessionId: string;
  consultationId: number;
  turnId?: string;
  text?: string;
  isFinal?: boolean;
  speakerLabel?: string | null;
  speakerRole?: "DENTIST" | "PATIENT" | "UNKNOWN";
  startMs?: number | null;
  endMs?: number | null;
  confidence?: number | null;
  provider?: StreamingProvider;
  model?: string;
  warnings?: string[];
  error?: string;
  integrity?: {
    audioPacketsSent: number;
    finalTurnsReceived: number;
    providerClosed: boolean;
    startedAt: string;
    endedAt: string;
  };
  createdAt: string;
};

export interface ConsultationStreamingProvider {
  readonly provider: StreamingProvider;
  readonly model: string;
  start(): Promise<void>;
  sendAudioPcm(chunk: Buffer): void;
  stop(): void;
  close(): void;
}

export type ProviderCallbacks = {
  onPartial: (payload: {
    text: string;
    speakerLabel?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    confidence?: number | null;
  }) => void;
  onFinal: (payload: {
    text: string;
    speakerLabel?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    confidence?: number | null;
  }) => void;
  onError: (message: string) => void;
  onClose: () => void;
};
