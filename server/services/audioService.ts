/**
 * Audio Service
 *
 * Handles audio upload, chunk management, and finalization logic
 * extracted from the consultations router.
 */
import { storagePut, storageDelete } from "../storage";
import { concatenateAudioChunksWithFfmpeg } from "../helpers/concatenateAudioChunks";
import { nanoid } from "nanoid";
import { createLogger } from "../lib/logger";

const log = createLogger("services:audio");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface UploadAudioInput {
  consultationId: number;
  userId: string;
  audioBase64: string;
  mimeType: string;
}

export interface UploadAudioResult {
  success: true;
  audioUrl: string;
  fileKey: string;
}

export interface UploadChunkInput {
  consultationId: number;
  userId: string;
  recordingSessionId: string;
  chunkIndex: number;
  audioBase64: string;
  mimeType: string;
}

export interface UploadChunkResult {
  success: true;
  chunkUrl: string;
  fileKey: string;
  sizeBytes: number;
}

export interface FinalizeRecordingInput {
  consultationId: number;
  userId: string;
  chunks: Array<{
    url: string;
    chunkIndex: number;
    mimeType: string;
    durationSeconds?: number | null;
    transcriptText?: string | null;
  }>;
  totalDurationSeconds?: number | null;
}

export interface FinalizeRecordingResult {
  success: true;
  audioUrl: string;
  fileKey: string;
  mergedTranscript: string | null;
}

export interface DeleteAudioFilesInput {
  audioFileKey?: string | null;
  chunkFileKeys: string[];
}

// --------------------------------------------------------------------------
// Upload full audio
// --------------------------------------------------------------------------

export async function uploadConsultationAudio(input: UploadAudioInput): Promise<UploadAudioResult> {
  const { consultationId, userId, audioBase64, mimeType } = input;

  log.info("Uploading consultation audio", { consultationId });

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const extension = mimeType.split("/")[1]?.split(";")[0] || "webm";
  const fileKey = `consultations/${userId}/${consultationId}/audio-${nanoid()}.${extension}`;
  const { url } = await storagePut(fileKey, audioBuffer, mimeType);

  log.info("Audio uploaded", { consultationId, sizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(1) });

  return { success: true, audioUrl: url, fileKey };
}

// --------------------------------------------------------------------------
// Upload chunk
// --------------------------------------------------------------------------

export async function uploadAudioChunk(input: UploadChunkInput): Promise<UploadChunkResult> {
  const { consultationId, userId, recordingSessionId, chunkIndex, audioBase64, mimeType } = input;

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const sizeBytes = audioBuffer.length;
  const extension = mimeType.split("/")[1]?.split(";")[0] || "webm";
  const fileKey = `consultations/${userId}/${consultationId}/chunks/${recordingSessionId}/chunk-${chunkIndex}-${nanoid(6)}.${extension}`;
  const { url } = await storagePut(fileKey, audioBuffer, mimeType);

  return { success: true, chunkUrl: url, fileKey, sizeBytes };
}

// --------------------------------------------------------------------------
// Finalize recording (concatenate chunks)
// --------------------------------------------------------------------------

export async function finalizeRecording(input: FinalizeRecordingInput): Promise<FinalizeRecordingResult> {
  const { consultationId, userId, chunks, totalDurationSeconds } = input;

  log.info("Finalizing recording", { consultationId, chunkCount: chunks.length });

  if (chunks.length === 0) {
    throw new Error("Nenhum chunk de áudio encontrado para esta sessão");
  }

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
  const finalFileKey = `consultations/${userId}/${consultationId}/audio-final-${nanoid()}.${extension}`;
  const { url: finalUrl } = await storagePut(finalFileKey, concatenatedBuffer, chunks[0].mimeType);

  const transcriptParts = chunks
    .map((c) => c.transcriptText)
    .filter((t): t is string => !!t && t.trim().length > 0);
  const mergedTranscript = transcriptParts.length > 0 ? transcriptParts.join("\n\n") : null;

  log.info("Recording finalized", {
    consultationId,
    sizeMB: (concatenatedBuffer.length / (1024 * 1024)).toFixed(1),
    hasTranscript: !!mergedTranscript,
  });

  return { success: true, audioUrl: finalUrl, fileKey: finalFileKey, mergedTranscript };
}

// --------------------------------------------------------------------------
// Delete audio files from S3
// --------------------------------------------------------------------------

export async function deleteAudioFiles(input: DeleteAudioFilesInput): Promise<void> {
  const deleteKeys = [input.audioFileKey, ...input.chunkFileKeys].filter(Boolean) as string[];

  for (const key of deleteKeys) {
    try {
      await storageDelete(key);
    } catch (e) {
      log.warn("Failed to delete S3 key", { key, error: String(e) });
    }
  }
}
