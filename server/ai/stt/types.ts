export type AudioType =
  | "consultation"
  | "call"
  | "whatsapp"
  | "progressive_chunk";

export type SpeakerRole = "DENTIST" | "PATIENT" | "CRC" | "LEAD" | "UNKNOWN";

export type TranscribeInput = {
  audioBuffer?: Buffer;
  audioUrl?: string;
  mimeType: string;
  audioType: AudioType;
  language?: "pt" | "pt-BR";
  enableDiarization?: boolean;
  vocabulary?: string[];
  providerOverride?: string;
  prompt?: string;
};

export type TranscribeSegment = {
  id: string;
  speakerLabel: string | null;
  speakerRole: SpeakerRole;
  start: number | null;
  end: number | null;
  text: string;
  confidence: number | null;
  flagged: boolean;
};

export type TranscribeResult = {
  transcript: string;
  segments: TranscribeSegment[];
  provider: string;
  model: string;
  fallbackUsed: boolean;
  warnings: string[];
  rawProviderMetadata?: Record<string, unknown>;
};

export type SpeechToTextProvider = {
  id: string;
  supportsDiarization: boolean;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
};
