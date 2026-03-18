/**
 * Concatenate WebM/audio chunks using ffmpeg.
 * Buffer.concat produces invalid WebM (each chunk has its own header).
 * ffmpeg concat demuxer produces a valid single file.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

export type ConcatenateResult = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Concatenate multiple audio buffers (WebM or other) into a single valid file.
 * Uses ffmpeg concat demuxer for proper container handling.
 */
export async function concatenateAudioChunksWithFfmpeg(
  chunkBuffers: Buffer[],
  mimeType: string
): Promise<ConcatenateResult> {
  if (chunkBuffers.length === 0) {
    throw new Error("No chunks to concatenate");
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "zeal-concat-"));
  const ext = mimeType.split("/")[1] || "webm";

  try {
    // Write each chunk to a temp file
    const chunkFiles: string[] = [];
    for (let i = 0; i < chunkBuffers.length; i++) {
      const filePath = path.join(tmpDir, `chunk_${i}.${ext}`);
      await fs.promises.writeFile(filePath, chunkBuffers[i]);
      chunkFiles.push(filePath);
    }

    // Create concat list file for ffmpeg (use forward slashes for cross-platform)
    const listPath = path.join(tmpDir, "concat.txt");
    const listContent = chunkFiles
      .map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await fs.promises.writeFile(listPath, listContent);

    const outputPath = path.join(tmpDir, `output.${ext}`);

    // ffmpeg -f concat -safe 0 -i concat.txt -c copy output.webm
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      outputPath,
    ]);

    const buffer = await fs.promises.readFile(outputPath);
    return { buffer, mimeType };
  } finally {
    // Cleanup
    try {
      const files = await fs.promises.readdir(tmpDir);
      for (const f of files) {
        await fs.promises.unlink(path.join(tmpDir, f)).catch(() => {});
      }
      await fs.promises.rmdir(tmpDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}
