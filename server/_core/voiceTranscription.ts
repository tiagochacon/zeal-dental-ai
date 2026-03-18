/**
 * Voice transcription helper using internal Speech-to-Text service
 *
 * Supports:
 * - Short audio (<25MB): direct transcription via Whisper API
 * - Long audio (>25MB, up to 1.5GB): chunked transcription using ffmpeg
 *   - Splits audio into ~10-minute chunks
 *   - 30-second overlap between chunks for context continuity
 *   - Passes last 80 words of previous chunk as prompt for next chunk
 *   - Adjusts timestamps with cumulative offset
 *   - Deduplicates overlap regions
 */
import { ENV } from "./env";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

export type TranscribeOptions = {
  audioUrl: string; // URL to the audio file (e.g., S3 URL)
  language?: string; // Optional: specify language code (e.g., "en", "es", "zh")
  prompt?: string; // Optional: custom prompt for the transcription
};

// Native Whisper API segment format
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

// ============================================
// CONSTANTS
// ============================================

const WHISPER_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB hard limit
const CHUNK_DURATION_SECONDS = 600; // 10 minutes per chunk
const OVERLAP_SECONDS = 30; // 30 seconds overlap between chunks
const CONTEXT_WORDS = 80; // Last N words passed as prompt to next chunk
const MAX_FILE_SIZE_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5GB

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Transcribe audio of any length.
 * - If ≤25MB: calls Whisper API directly (transcribeAudioDirect)
 * - If >25MB: splits into chunks with ffmpeg, transcribes each, concatenates
 */
export async function transcribeLongAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    // Validate environment
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY is not set"
      };
    }

    // Download audio to temp file
    console.log(`[Transcription] Downloading audio from URL: ${options.audioUrl}`);
    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      audioBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || '';
      
      // If S3 returns application/octet-stream, infer from URL extension
      if (!contentType || contentType === 'application/octet-stream') {
        const urlPath = new URL(options.audioUrl).pathname.toLowerCase();
        if (urlPath.endsWith('.webm')) mimeType = 'audio/webm';
        else if (urlPath.endsWith('.mp3')) mimeType = 'audio/mpeg';
        else if (urlPath.endsWith('.wav')) mimeType = 'audio/wav';
        else if (urlPath.endsWith('.m4a')) mimeType = 'audio/mp4';
        else if (urlPath.endsWith('.ogg')) mimeType = 'audio/ogg';
        else if (urlPath.endsWith('.flac')) mimeType = 'audio/flac';
        else mimeType = 'audio/mpeg';
        console.log(`[Transcription] Content-Type was '${contentType}', inferred from URL: ${mimeType}`);
      } else {
        mimeType = contentType;
        if (mimeType.includes('webm')) mimeType = 'audio/webm';
        else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) mimeType = 'audio/mpeg';
        console.log(`[Transcription] Using Content-Type: ${mimeType}`);
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }

    const sizeMB = audioBuffer.length / (1024 * 1024);
    console.log(`[Transcription] Audio downloaded: ${sizeMB.toFixed(2)}MB, type: ${mimeType}`);

    // Check max file size
    if (audioBuffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        error: "Arquivo de áudio excede o limite máximo de 1.5GB",
        code: "FILE_TOO_LARGE",
        details: `Tamanho: ${sizeMB.toFixed(0)}MB, máximo: 1536MB`
      };
    }

    // Route: small file → direct, large file → chunked
    if (audioBuffer.length <= WHISPER_MAX_SIZE_BYTES) {
      console.log(`[Transcription] File ≤25MB, using direct transcription`);
      return await transcribeAudioDirect(audioBuffer, mimeType, options);
    } else {
      console.log(`[Transcription] File >25MB (${sizeMB.toFixed(0)}MB), using chunked transcription`);
      return await transcribeAudioChunked(audioBuffer, mimeType, options);
    }
  } catch (error) {
    console.error("[Transcription] Unexpected error:", error);
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

// Keep original function name for backward compatibility
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  return transcribeLongAudio(options);
}

// ============================================
// DIRECT TRANSCRIPTION (≤25MB)
// ============================================

async function transcribeAudioDirect(
  audioBuffer: Buffer,
  mimeType: string,
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  const formData = new FormData();
  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const prompt = options.prompt || (
    options.language
      ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
      : "Transcribe the user's voice to text"
  );
  formData.append("prompt", prompt);

  const baseUrl = ENV.forgeApiUrl!.endsWith("/") ? ENV.forgeApiUrl! : `${ENV.forgeApiUrl!}/`;
  const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      "Accept-Encoding": "identity",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      error: "Transcription service request failed",
      code: "TRANSCRIPTION_FAILED",
      details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
    };
  }

  const whisperResponse = await response.json() as WhisperResponse;

  if (!whisperResponse.text || typeof whisperResponse.text !== 'string') {
    return {
      error: "Invalid transcription response",
      code: "SERVICE_ERROR",
      details: "Transcription service returned an invalid response format"
    };
  }

  return whisperResponse;
}

// ============================================
// CHUNKED TRANSCRIPTION (>25MB)
// ============================================

async function transcribeAudioChunked(
  audioBuffer: Buffer,
  mimeType: string,
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zeal-transcribe-'));

  try {
    // Step 1: Write audio to temp file
    const ext = getFileExtension(mimeType);
    const inputFile = path.join(tmpDir, `input.${ext}`);
    await fs.promises.writeFile(inputFile, audioBuffer);

    // Step 2: Get audio duration using ffprobe
    const duration = await getAudioDuration(inputFile);
    console.log(`[Transcription] Audio duration: ${(duration / 60).toFixed(1)} minutes`);

    // Step 3: Calculate chunk boundaries
    const chunks = calculateChunkBoundaries(duration);
    console.log(`[Transcription] Splitting into ${chunks.length} chunks`);

    // Step 4: Split audio into chunks using ffmpeg
    const chunkFiles = await splitAudioIntoChunks(inputFile, chunks, tmpDir);

    // Step 5: Transcribe each chunk with context preservation
    const allSegments: WhisperSegment[] = [];
    let fullText = "";
    let detectedLanguage = options.language || "pt";
    let previousChunkLastWords = "";

    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkFile = chunkFiles[i];
      const chunk = chunks[i];

      console.log(`[Transcription] Transcribing chunk ${i + 1}/${chunkFiles.length} (${chunk.startSec}s - ${chunk.endSec}s)`);

      // Build prompt with context from previous chunk
      let chunkPrompt = options.prompt || "Transcrição de consulta odontológica clínica. Português brasileiro.";
      if (i > 0 && previousChunkLastWords) {
        chunkPrompt = `Continuação da transcrição. Contexto anterior: "${previousChunkLastWords}". ${chunkPrompt}`;
      }

      // Read chunk file
      const chunkBuffer = await fs.promises.readFile(chunkFile);

      // Check if chunk is still too large (shouldn't happen with 10min chunks, but safety)
      if (chunkBuffer.length > WHISPER_MAX_SIZE_BYTES) {
        const chunkSizeMB = (chunkBuffer.length / (1024 * 1024)).toFixed(1);
        console.warn(`[Transcription] Chunk ${i + 1} is ${chunkSizeMB}MB (>25MB). Converting to MP3 32kbps...`);
        
        // Convert to MP3 32kbps mono 16kHz (almost always <25MB for 10min audio)
        const compressedFile = path.join(tmpDir, `chunk_${i}_compressed.mp3`);
        try {
          await execFileAsync('ffmpeg', [
            '-i', chunkFile,
            '-c:a', 'libmp3lame',
            '-b:a', '32k',
            '-ar', '16000',
            '-ac', '1',
            '-y', compressedFile
          ]);
        } catch (ffmpegError) {
          console.error(`[Transcription] Chunk ${i + 1} ffmpeg compression failed:`, ffmpegError);
          throw new Error(`Failed to compress chunk ${i + 1}: ${ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError)}`);
        }
        
        const compressedBuffer = await fs.promises.readFile(compressedFile);
        const compressedSizeMB = (compressedBuffer.length / (1024 * 1024)).toFixed(1);
        console.log(`[Transcription] Chunk ${i + 1} compressed: ${chunkSizeMB}MB → ${compressedSizeMB}MB`);
        
        if (compressedBuffer.length > WHISPER_MAX_SIZE_BYTES) {
          console.error(`[Transcription] Chunk ${i + 1} still too large after MP3 compression: ${compressedSizeMB}MB. This should not happen.`);
          throw new Error(`Chunk ${i + 1} exceeds 25MB limit even after MP3 32kbps compression (${compressedSizeMB}MB). Duration may be >10 minutes.`);
        }
        
        // Use compressed buffer
        console.log(`[Transcription] Transcribing compressed chunk ${i + 1}/${chunkFiles.length}`);
        const result = await transcribeAudioDirect(compressedBuffer, 'audio/mp3', {
          ...options,
          prompt: chunkPrompt,
        });
        
        if ('error' in result) {
          console.error(`[Transcription] Chunk ${i + 1} transcription failed:`, result.error);
          throw new Error(`Chunk ${i + 1} transcription failed: ${result.error}`);
        }
        
        console.log(`[Transcription] Chunk ${i + 1} transcribed successfully: ${result.text.length} chars`);
        processChunkResult(result, chunk, i, allSegments, chunks);
        fullText += (fullText ? " " : "") + result.text.trim();
        detectedLanguage = result.language || detectedLanguage;
        previousChunkLastWords = getLastNWords(result.text, CONTEXT_WORDS);
        continue;
      }

      // Transcribe chunk
      const chunkSizeMB = (chunkBuffer.length / (1024 * 1024)).toFixed(1);
      console.log(`[Transcription] Transcribing chunk ${i + 1}/${chunkFiles.length} (${chunkSizeMB}MB, ${chunk.startSec}s - ${chunk.endSec}s)`);
      const result = await transcribeAudioDirect(chunkBuffer, mimeType, {
        ...options,
        prompt: chunkPrompt,
      });

      if ('error' in result) {
        console.error(`[Transcription] Chunk ${i + 1} transcription failed:`, result.error);
        throw new Error(`Chunk ${i + 1} transcription failed: ${result.error}`);
      }
      
      console.log(`[Transcription] Chunk ${i + 1} transcribed successfully: ${result.text.length} chars`);


      // Process segments with timestamp offset and overlap dedup
      processChunkResult(result, chunk, i, allSegments, chunks);

      // Accumulate text (excluding overlap region text for non-first chunks)
      if (i === 0) {
        fullText = result.text.trim();
      } else {
        // Remove overlap text: skip segments that fall within the overlap region
        const overlapEnd = OVERLAP_SECONDS;
        const nonOverlapText = (result.segments || [])
          .filter(seg => seg.start >= overlapEnd)
          .map(seg => seg.text)
          .join("")
          .trim();
        fullText += " " + (nonOverlapText || result.text.trim());
      }

      detectedLanguage = result.language || detectedLanguage;
      previousChunkLastWords = getLastNWords(result.text, CONTEXT_WORDS);
    }

    if (!fullText) {
      return {
        error: "Nenhum chunk foi transcrito com sucesso",
        code: "TRANSCRIPTION_FAILED",
        details: `${chunkFiles.length} chunks processados, todos falharam`
      };
    }

    // Renumber segment IDs sequentially
    allSegments.forEach((seg, idx) => { seg.id = idx; });

    const totalDuration = allSegments.length > 0
      ? allSegments[allSegments.length - 1].end
      : duration;

    console.log(`[Transcription] Chunked transcription complete: ${allSegments.length} segments, ${(totalDuration / 60).toFixed(1)} min`);

    return {
      task: "transcribe",
      language: detectedLanguage,
      duration: totalDuration,
      text: fullText.trim(),
      segments: allSegments,
    };

  } finally {
    // Cleanup temp files
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {
      console.warn(`[Transcription] Failed to cleanup temp dir: ${tmpDir}`);
    }
  }
}

// ============================================
// CHUNK HELPERS
// ============================================

type ChunkBoundary = {
  startSec: number;
  endSec: number;
  effectiveStartSec: number; // Start after deducting overlap (for timestamp offset)
};

function calculateChunkBoundaries(totalDuration: number): ChunkBoundary[] {
  const chunks: ChunkBoundary[] = [];
  let currentStart = 0;

  while (currentStart < totalDuration) {
    const endSec = Math.min(currentStart + CHUNK_DURATION_SECONDS, totalDuration);
    const effectiveStartSec = chunks.length === 0 ? 0 : currentStart + OVERLAP_SECONDS;

    chunks.push({
      startSec: currentStart,
      endSec,
      effectiveStartSec,
    });

    // Next chunk starts CHUNK_DURATION - OVERLAP before the end of this chunk
    currentStart = endSec - OVERLAP_SECONDS;

    // Avoid tiny last chunks
    if (totalDuration - currentStart < 60 && currentStart < totalDuration) {
      // Extend last chunk to cover remaining
      chunks[chunks.length - 1].endSec = totalDuration;
      break;
    }
  }

  return chunks;
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      throw new Error("Could not parse duration");
    }
    return duration;
  } catch (error) {
    console.warn("[Transcription] ffprobe failed, estimating duration from file size");
    // Rough estimate: assume 128kbps for unknown formats
    const stats = await fs.promises.stat(filePath);
    return (stats.size * 8) / (128 * 1000);
  }
}

async function splitAudioIntoChunks(
  inputFile: string,
  chunks: ChunkBoundary[],
  tmpDir: string
): Promise<string[]> {
  const chunkFiles: string[] = [];
  const ext = path.extname(inputFile);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkFile = path.join(tmpDir, `chunk_${i}${ext}`);
    const duration = chunk.endSec - chunk.startSec;

    // Use re-encoding instead of -c copy for compatibility with all formats
    // (WebM/Opus, AAC containers, etc. often fail with stream copy)
    const outputExt = ext === '.webm' || ext === '.ogg' ? '.mp3' : ext;
    const actualChunkFile = outputExt !== ext 
      ? path.join(tmpDir, `chunk_${i}${outputExt}`) 
      : chunkFile;
    
    await execFileAsync('ffmpeg', [
      '-i', inputFile,
      '-ss', String(chunk.startSec),
      '-t', String(duration),
      '-vn',           // No video
      '-ar', '16000',  // 16kHz sample rate (Whisper optimal)
      '-ac', '1',      // Mono
      '-b:a', '64k',   // 64kbps (good quality for speech)
      '-y',
      actualChunkFile
    ]);

    // Verify chunk was created
    try {
      const stats = await fs.promises.stat(actualChunkFile);
      if (stats.size > 0) {
        chunkFiles.push(actualChunkFile);
        console.log(`[Transcription] Chunk ${i + 1}: ${(stats.size / (1024 * 1024)).toFixed(1)}MB (${chunk.startSec}s - ${chunk.endSec}s)`);
      }
    } catch {
      console.warn(`[Transcription] Failed to create chunk ${i + 1}`);
    }
  }

  return chunkFiles;
}

function processChunkResult(
  result: WhisperResponse,
  chunk: ChunkBoundary,
  chunkIndex: number,
  allSegments: WhisperSegment[],
  allChunks: ChunkBoundary[]
): void {
  if (!result.segments || result.segments.length === 0) return;

  const timeOffset = chunk.startSec;

  for (const seg of result.segments) {
    // For non-first chunks, skip segments in the overlap region
    // (they were already captured by the previous chunk)
    if (chunkIndex > 0 && seg.end <= OVERLAP_SECONDS) {
      continue;
    }

    // Adjust timestamps with offset
    const adjustedSeg: WhisperSegment = {
      ...seg,
      start: seg.start + timeOffset,
      end: seg.end + timeOffset,
    };

    // Avoid duplicate segments at chunk boundaries
    if (allSegments.length > 0) {
      const lastSeg = allSegments[allSegments.length - 1];
      // Skip if this segment overlaps significantly with the last one
      if (adjustedSeg.start < lastSeg.end - 1) {
        continue;
      }
    }

    allSegments.push(adjustedSeg);
  }
}

function getLastNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(-n).join(" ");
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/mp4;codecs=mp4a.40.2': 'm4a',
    'audio/aac': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mp4a-latm': 'm4a',
  };
  return mimeToExt[mimeType] || 'audio';
}

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
  };
  return langMap[langCode] || langCode;
}
