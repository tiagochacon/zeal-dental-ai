/**
 * Normalize audio chunks from MediaRecorder (WebM) to valid MP3 format
 * This ensures each chunk is a valid, self-contained audio file that Whisper can decode
 */
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

/**
 * Normalize a WebM chunk to MP3 format
 * @param audioBuffer - Raw audio buffer from MediaRecorder
 * @param mimeType - MIME type of the input (e.g., "audio/webm")
 * @returns Normalized MP3 buffer ready for Whisper transcription
 */
export async function normalizeAudioChunkToMp3(
  audioBuffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputFile = path.join(tmpDir, `chunk-input-${Date.now()}.webm`);
  const outputFile = path.join(tmpDir, `chunk-output-${Date.now()}.mp3`);

  try {
    // Write input buffer to temp file
    await fs.promises.writeFile(inputFile, audioBuffer);

    // Normalize to MP3: mono, 16kHz, 32kbps (ensures small, valid file)
    // -y: overwrite output file
    // -ac 1: mono
    // -ar 16000: 16kHz sample rate
    // -b:a 32k: 32kbps bitrate (very compressed but acceptable for speech)
    // -q:a 9: quality (lower is better, but 32kbps is already very compressed)
    await execFileAsync("ffmpeg", [
      "-i", inputFile,
      "-c:a", "libmp3lame",
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "32k",
      "-y", outputFile
    ]);

    // Read normalized MP3
    const normalizedBuffer = await fs.promises.readFile(outputFile);
    const result = Buffer.isBuffer(normalizedBuffer) ? normalizedBuffer : Buffer.from(normalizedBuffer);
    
    console.log(
      `[NormalizeChunk] Normalized: ${(audioBuffer.length / 1024).toFixed(1)}KB → ${(result.length / 1024).toFixed(1)}KB`
    );

    return result;
  } catch (error) {
    console.error("[NormalizeChunk] Normalization failed:", error);
    throw new Error(
      `Failed to normalize audio chunk: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    // Clean up temp files
    try {
      await fs.promises.unlink(inputFile);
    } catch {}
    try {
      await fs.promises.unlink(outputFile);
    } catch {}
  }
}
