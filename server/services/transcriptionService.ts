/**
 * Transcription Service
 *
 * Extracts audio transcription logic from the consultations router
 * into a testable, reusable service layer.
 */
import { transcribeLongAudio } from "../_core/voiceTranscription";
import { revalidateConsultationTranscript } from "../helpers/transcriptRevalidation";
import { storagePut } from "../storage";
import { concatenateAudioChunksWithFfmpeg } from "../helpers/concatenateAudioChunks";
import { nanoid } from "nanoid";
import { createLogger } from "../lib/logger";

const log = createLogger("services:transcription");

// Conservative dental prompt for STT context
const CONSERVATIVE_DENTAL_PROMPT = "Transcrição de consulta odontológica em português brasileiro. Termos comuns: restauração, canal, implante, prótese, gengivite, periodontite, cárie, oclusão, bruxismo, ATM.";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface TranscribeAudioInput {
  consultationId: number;
  audioUrl: string;
  userId: string;
}

export interface TranscribeAudioResult {
  success: true;
  transcript: string;
  segments?: unknown[];
}

export interface RecoverAudioFromChunksInput {
  consultationId: number;
  userId: string;
  chunks: Array<{
    url: string;
    chunkIndex: number;
    mimeType: string;
    durationSeconds?: number | null;
  }>;
}

export interface RecoverAudioResult {
  audioUrl: string;
  fileKey: string;
  totalDuration: number | null;
}

// --------------------------------------------------------------------------
// Chunk recovery
// --------------------------------------------------------------------------

export async function recoverAudioFromChunks(input: RecoverAudioFromChunksInput): Promise<RecoverAudioResult> {
  const { consultationId, userId, chunks } = input;

  log.info("Recovering audio from chunks", { consultationId, chunkCount: chunks.length });

  const chunkBuffers = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(chunk.url);
      if (!response.ok) {
        throw new Error(`Falha ao baixar chunk ${chunk.chunkIndex}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    })
  );

  let concatenatedBuffer: Buffer;
  try {
    const result = await concatenateAudioChunksWithFfmpeg(chunkBuffers, chunks[0].mimeType);
    concatenatedBuffer = result.buffer;
  } catch (ffmpegError) {
    log.warn("ffmpeg concat failed, falling back to Buffer.concat", { consultationId, error: String(ffmpegError) });
    concatenatedBuffer = Buffer.concat(chunkBuffers);
  }

  const extension = chunks[0].mimeType.split("/")[1] || "webm";
  const finalFileKey = `consultations/${userId}/${consultationId}/audio-recovered-${nanoid()}.${extension}`;
  const { url: finalUrl } = await storagePut(finalFileKey, concatenatedBuffer, chunks[0].mimeType);

  const totalDuration = chunks.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);

  log.info("Audio recovered from chunks", {
    consultationId,
    chunkCount: chunks.length,
    sizeMB: (concatenatedBuffer.length / (1024 * 1024)).toFixed(1),
  });

  return {
    audioUrl: finalUrl,
    fileKey: finalFileKey,
    totalDuration: totalDuration || null,
  };
}

// --------------------------------------------------------------------------
// Main transcription
// --------------------------------------------------------------------------

export async function transcribeConsultationAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  const { consultationId, audioUrl } = input;

  log.info("Starting transcription", { consultationId });

  const result = await transcribeLongAudio({
    audioUrl,
    language: "pt",
    prompt: CONSERVATIVE_DENTAL_PROMPT,
  });

  if ("error" in result) {
    log.error("Transcription failed", { consultationId, error: result.error });
    throw new Error(`Erro na transcrição: ${result.error}`);
  }

  // AI revalidation pass: corrects residual STT errors using dental clinical
  // context (technical talk + personal rapport), preserving fidelity. Never
  // blocks finalization — falls back to the raw transcript on any failure.
  let finalTranscript = result.text;
  try {
    const revalidated = await revalidateConsultationTranscript(result.text, consultationId);
    finalTranscript = revalidated.text;
    if (revalidated.changed) {
      log.info("Transcript revalidated by AI", { consultationId });
    }
  } catch (revalErr) {
    log.warn("Revalidation failed; using raw transcript", { consultationId, error: String(revalErr) });
  }

  log.info("Transcription completed", { consultationId, transcriptLength: finalTranscript.length });

  return {
    success: true,
    transcript: finalTranscript,
    segments: result.segments || [],
  };
}

// --------------------------------------------------------------------------
// Single chunk transcription
// --------------------------------------------------------------------------

export async function transcribeSingleChunk(audioUrl: string, chunkIndex: number): Promise<string> {
  log.info("Transcribing single chunk", { chunkIndex });

  const result = await transcribeLongAudio({
    audioUrl,
    language: "pt",
    prompt: CONSERVATIVE_DENTAL_PROMPT,
  });

  if ("error" in result) {
    const errorMsg = `Chunk ${chunkIndex} transcription failed: ${result.error}${(result as any).details ? ` (${(result as any).details})` : ""}`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  return result.text;
}
