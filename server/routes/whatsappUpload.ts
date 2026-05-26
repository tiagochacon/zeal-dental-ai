/**
 * WhatsApp Export Upload Route
 * Accepts .zip files exported from WhatsApp, extracts the chat text file,
 * transcribes audio files, and builds a unified transcript.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import JSZip, { type JSZipObject } from "jszip";
import { nanoid } from "nanoid";
import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { storagePut } from "../storage";
import { getCallById, updateCall, getUserById } from "../db";
import { sdk } from "../_core/sdk";
import { parseWhatsAppChat, buildUnifiedTranscript } from "../helpers/whatsappExportParser";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeAI } from "../ai/invokeAI";
import type { WhatsAppImportData, WhatsAppMediaSummary } from "../../drizzle/schema";

export const ZIP_MAX_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB per audio file
const LARGE_TXT_THRESHOLD = 10 * 1024 * 1024; // 10MB
const LARGE_TXT_CHUNK_CHARS = 12000;
const AUDIO_EXTENSIONS = [".opus", ".ogg", ".m4a", ".mp3", ".wav", ".aac"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp"];
const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".vcf", ".pptx", ".ppt"];
const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".com", ".vbs", ".js"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".zip";
      cb(null, `zeal-wa-${Date.now()}-${nanoid(8)}${ext}`);
    },
  }),
  limits: { fileSize: ZIP_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .zip são aceitos"));
    }
  },
});

const router = Router();

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function sanitizePath(entryName: string): string | null {
  // Protect against Zip Slip
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) return null;
  // Take only the filename (ignore directory structure)
  const parts = normalized.split("/");
  return parts[parts.length - 1] || null;
}

function getMimeForAudio(ext: string): string {
  const map: Record<string, string> = {
    ".opus": "audio/ogg",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
  };
  return map[ext] || "audio/ogg";
}

function splitTranscriptIntoChunks(transcript: string, maxChars = LARGE_TXT_CHUNK_CHARS): string[] {
  const lines = transcript.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    // Keep message boundaries (line-based) whenever possible.
    if (!current) {
      current = line;
      continue;
    }
    if ((current.length + 1 + line.length) <= maxChars) {
      current += `\n${line}`;
      continue;
    }
    chunks.push(current);
    current = line;
  }
  if (current) chunks.push(current);
  return chunks;
}

function summarizeChunkHeuristically(chunk: string): string {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  const relevant = lines.filter((line) =>
    /(dor|dói|doendo|urg|agendar|consulta|orçamento|preço|valor|caro|tempo|medo|confian|seguran|fechar|implante|clareamento|canal|aparelho|revisão|retorno)/i.test(line)
  );
  const picked = relevant.length > 0 ? relevant.slice(0, 10) : lines.slice(0, 10);
  return picked.join(" ");
}

async function consolidateLargeTranscript(
  chunkSummaries: string[],
  leadName: string | null
): Promise<string> {
  if (chunkSummaries.length === 0) return "";
  if (chunkSummaries.length > 12) {
    // Avoid long-running LLM calls for very large files in a single request.
    return chunkSummaries.join("\n\n");
  }

  const response = await invokeAI("whatsapp_summary", {
    messages: [
      {
        role: "system",
        content:
          "Você é um analista de conversas comerciais odontológicas. Consolide resumos parciais em um único resumo factual, sem inventar informações.",
      },
      {
        role: "user",
        content:
          `Consolide os resumos parciais abaixo de uma conversa de WhatsApp com lead${leadName ? ` (${leadName})` : ""}.\n` +
          "Retorne somente texto corrido com os pontos mais relevantes: dor/queixa, motivação, objeções, urgência, confiança/desconfiança e próximos passos.\n\n" +
          chunkSummaries.map((s, i) => `Resumo ${i + 1}: ${s}`).join("\n\n"),
      },
    ],
    temperature: 0.1,
    seed: 42,
  });

  if (!response.success) {
    return chunkSummaries.join("\n\n");
  }

  const content = response.response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return chunkSummaries.join("\n\n");
  }
  return content.trim();
}

router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    let uploadedFilePath: string | null = null;
    try {
      // Authenticate
      let user;
      try {
        const authUser = await sdk.authenticateRequest(req);
        user = await getUserById(authUser.id);
      } catch {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!user || !user.clinicId) {
        return res.status(403).json({ error: "Você precisa estar vinculado a uma clínica" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }
      uploadedFilePath = file.path;

      const callId = parseInt(req.body.callId);
      if (!callId || isNaN(callId)) {
        return res.status(400).json({ error: "ID da interação inválido" });
      }

      const call = await getCallById(callId);
      if (!call || call.clinicId !== user.clinicId) {
        return res.status(404).json({ error: "Interação não encontrada" });
      }

      // Lead name for speaker role inference
      const leadName = req.body.leadName || call.leadName || null;
      const crcName = user.name || null;

      console.log(`[WhatsApp] Processing ZIP for call ${callId} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);

      // Extract ZIP
      let zip: JSZip;
      try {
        const zipBuffer = await fs.readFile(file.path);
        zip = await JSZip.loadAsync(zipBuffer);
      } catch {
        return res.status(400).json({ error: "Arquivo ZIP inválido ou corrompido" });
      }

      // Collect all files from ZIP, categorized
      let chatContent: string | null = null;
      let chatContentSizeBytes = 0;
      let chatFileName: string | null = null;
      const audioFiles: Array<{ name: string; buffer: Buffer; ext: string }> = [];
      const imageFiles: string[] = [];
      const skippedFiles: Array<{ fileName: string; reason: string }> = [];
      const unsupportedFiles: string[] = [];
      const txtCandidates: Array<{ name: string; entry: JSZipObject }> = [];

      const zipFiles = Object.entries(zip.files) as Array<[string, JSZipObject]>;
      for (const [entryName, entry] of zipFiles) {
        if (entry.dir) continue;

        const safeName = sanitizePath(entryName);
        if (!safeName) {
          skippedFiles.push({ fileName: entryName, reason: "Path inseguro" });
          continue;
        }

        const ext = getExtension(safeName);

        // Reject dangerous files
        if (DANGEROUS_EXTENSIONS.includes(ext)) {
          skippedFiles.push({ fileName: safeName, reason: "Extensão não permitida" });
          continue;
        }

        // Collect .txt files as chat candidates
        if (ext === ".txt") {
          txtCandidates.push({ name: safeName, entry });
          continue;
        }

        // Ignore videos — never extract buffer, just register
        if (VIDEO_EXTENSIONS.includes(ext)) {
          skippedFiles.push({ fileName: safeName, reason: "Vídeo ignorado (não processado)" });
          console.log(`[WhatsApp] Skipping video: ${safeName}`);
          continue;
        }

        // Ignore documents and other irrelevant files — never extract buffer
        if (DOCUMENT_EXTENSIONS.includes(ext)) {
          skippedFiles.push({ fileName: safeName, reason: "Documento ignorado" });
          continue;
        }

        // Collect audio files — extract buffer only for audio
        if (AUDIO_EXTENSIONS.includes(ext)) {
          try {
            // Check compressed size first to avoid loading huge files
            const compressedSize = (entry as any)._data?.compressedSize;
            if (compressedSize && compressedSize > MAX_AUDIO_SIZE) {
              skippedFiles.push({ fileName: safeName, reason: `Áudio muito grande (comprimido: ${(compressedSize / (1024 * 1024)).toFixed(1)}MB)` });
              console.log(`[WhatsApp] Skipping large audio (compressed check): ${safeName}`);
              continue;
            }
            const buf = await entry.async("nodebuffer");
            if (buf.length > MAX_AUDIO_SIZE) {
              skippedFiles.push({ fileName: safeName, reason: `Áudio muito grande (${(buf.length / (1024 * 1024)).toFixed(1)}MB)` });
              console.log(`[WhatsApp] Skipping large audio: ${safeName} (${(buf.length / (1024 * 1024)).toFixed(1)}MB)`);
            } else {
              audioFiles.push({ name: safeName, buffer: buf, ext });
            }
          } catch {
            skippedFiles.push({ fileName: safeName, reason: "Erro ao extrair áudio" });
          }
          continue;
        }

        // Register image files (no buffer extraction, no processing)
        if (IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(safeName);
          continue;
        }

        // Skip any other unrecognized files
        unsupportedFiles.push(safeName);
      }

      // Identify the chat file among .txt candidates
      // Strategy: if only 1 .txt → use it; if multiple → score by WhatsApp message patterns
      if (txtCandidates.length === 0) {
        return res.status(400).json({
          error: "Nenhum arquivo de texto (.txt) encontrado no ZIP. Certifique-se de exportar a conversa pelo WhatsApp.",
        });
      }

      // WhatsApp message line pattern for scoring
      const WA_MSG_PATTERN = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]+\d{1,2}:\d{2}/;

      const readTxtEntry = async (entry: JSZipObject): Promise<{ content: string; sizeBytes: number }> => {
        const buf = await entry.async("nodebuffer");
        let content = buf.toString("utf-8");
        if (content.startsWith("\ufeff")) {
          content = content.slice(1);
        }
        return { content, sizeBytes: buf.length };
      }

      const scoreWhatsAppContent = (content: string): number => {
        // Sample the first 50 lines and count how many match WhatsApp message patterns
        const lines = content.split(/\r?\n/).slice(0, 50);
        let matches = 0;
        for (const line of lines) {
          if (WA_MSG_PATTERN.test(line.trim())) matches++;
        }
        return matches;
      }

      if (txtCandidates.length === 1) {
        // Single .txt file — use it directly
        try {
          const txtData = await readTxtEntry(txtCandidates[0].entry);
          chatContent = txtData.content;
          chatContentSizeBytes = txtData.sizeBytes;
          chatFileName = txtCandidates[0].name;
          console.log(`[WhatsApp] Single .txt found: ${chatFileName} (${(chatContentSizeBytes / (1024 * 1024)).toFixed(2)}MB)`);
        } catch {
          skippedFiles.push({ fileName: txtCandidates[0].name, reason: "Erro ao ler arquivo de chat" });
        }
      } else {
        // Multiple .txt files — score by WhatsApp pattern first, then by file size.
        console.log(`[WhatsApp] Multiple .txt files found (${txtCandidates.length}), scoring by content...`);
        let bestScore = -1;
        let bestSize = -1;
        for (const candidate of txtCandidates) {
          try {
            const txtData = await readTxtEntry(candidate.entry);
            const score = scoreWhatsAppContent(txtData.content);
            const sizeMb = (txtData.sizeBytes / (1024 * 1024)).toFixed(2);
            console.log(`[WhatsApp]   ${candidate.name}: score=${score} size=${sizeMb}MB`);
            if (score > bestScore || (score === bestScore && txtData.sizeBytes > bestSize)) {
              bestScore = score;
              bestSize = txtData.sizeBytes;
              chatContent = txtData.content;
              chatContentSizeBytes = txtData.sizeBytes;
              chatFileName = candidate.name;
            }
          } catch {
            skippedFiles.push({ fileName: candidate.name, reason: "Erro ao ler arquivo .txt" });
          }
        }
      }

      if (!chatContent || !chatFileName) {
        return res.status(400).json({
          error: "Não foi possível localizar o arquivo de mensagens da conversa dentro do ZIP. Certifique-se de exportar a conversa pelo WhatsApp.",
        });
      }

      // Validate that the selected file actually looks like a WhatsApp chat
      const chatScore = scoreWhatsAppContent(chatContent);
      if (chatScore === 0) {
        return res.status(400).json({
          error: `O arquivo '${chatFileName}' não parece conter mensagens do WhatsApp. Verifique se você exportou a conversa corretamente.`,
        });
      }

      // Parse chat
      const parseResult = parseWhatsAppChat(chatContent, leadName, crcName);

      if (parseResult.messages.length === 0) {
        return res.status(400).json({
          error: "Nenhuma mensagem encontrada no arquivo de chat. O formato pode ser incompatível.",
        });
      }

      // Transcribe audio files
      const audioTranscripts: WhatsAppMediaSummary["audioTranscripts"] = [];
      const audioTranscriptMap = new Map<string, string>();

      for (const audio of audioFiles) {
        try {
          console.log(`[WhatsApp] Transcribing audio: ${audio.name} (${(audio.buffer.length / 1024).toFixed(0)}KB)`);

          // Upload audio to S3 temporarily for transcription
          const tempKey = `whatsapp-temp/${user.id}/${callId}/${nanoid(8)}${audio.ext}`;
          const { url: audioUrl } = await storagePut(tempKey, audio.buffer, getMimeForAudio(audio.ext));

          const result = await transcribeAudio({
            audioUrl,
            audioType: "whatsapp",
            language: "pt",
            prompt: "Transcrição de áudio de conversa WhatsApp. Português brasileiro. Diálogo entre atendente de clínica odontológica e paciente/lead.",
          });

          if ("error" in result) {
            console.warn(`[WhatsApp] Failed to transcribe ${audio.name}: ${result.error}`);
            audioTranscripts.push({
              fileName: audio.name,
              speakerGuess: "unknown",
              transcript: "",
              durationSeconds: null,
              status: "failed",
              error: result.error,
            });
          } else {
            audioTranscripts.push({
              fileName: audio.name,
              speakerGuess: "unknown",
              transcript: result.text,
              durationSeconds: result.duration || null,
              status: "transcribed",
              error: null,
            });
            audioTranscriptMap.set(audio.name, result.text);
          }
        } catch (err: any) {
          console.warn(`[WhatsApp] Error transcribing ${audio.name}:`, err?.message);
          audioTranscripts.push({
            fileName: audio.name,
            speakerGuess: "unknown",
            transcript: "",
            durationSeconds: null,
            status: "failed",
            error: err?.message || "Erro desconhecido",
          });
        }
      }

      // Build unified transcript
      const transcript = buildUnifiedTranscript(parseResult, audioTranscriptMap);
      const isLargeTxt = chatContentSizeBytes > LARGE_TXT_THRESHOLD;
      const transcriptForStorage = transcript;
      let largeTextSummary: string | null = null;
      let chunkCount = 0;
      if (isLargeTxt) {
        const transcriptChunks = splitTranscriptIntoChunks(transcript);
        chunkCount = transcriptChunks.length;
        console.log(
          `[WhatsApp] Large TXT detected (${(chatContentSizeBytes / (1024 * 1024)).toFixed(2)}MB) - using chunk flow with ${chunkCount} chunks`
        );
        const partials = transcriptChunks.map((chunk) => summarizeChunkHeuristically(chunk));
        const consolidated = await consolidateLargeTranscript(partials, leadName);
        largeTextSummary =
          `[WhatsApp Exportado - Resumo Consolidado]\n` +
          `Arquivo de conversa: ${chatFileName}\n` +
          `Tamanho TXT: ${(chatContentSizeBytes / (1024 * 1024)).toFixed(2)}MB\n` +
          `Chunks processados: ${chunkCount}\n\n` +
          consolidated;
      }

      // Count messages by role
      const leadMessages = parseResult.messages.filter((m) => m.speakerRole === "lead").length;
      const crcMessages = parseResult.messages.filter((m) => m.speakerRole === "crc").length;

      // Count ignored categories
      const videosIgnored = skippedFiles.filter((f) => f.reason.startsWith("Vídeo ignorado")).length;
      const audiosSkipped = skippedFiles.filter((f) => f.reason.startsWith("Áudio muito grande")).length;
      const docsIgnored = skippedFiles.filter((f) => f.reason.startsWith("Documento ignorado")).length;

      // Build import data
      const importData: WhatsAppImportData = {
        fileName: file.originalname,
        importedAt: new Date().toISOString(),
        chatFileName,
        totalMessages: parseResult.messages.filter((m) => m.messageType !== "system").length,
        leadMessages,
        crcMessages,
        audioFilesFound: audioFiles.length + audiosSkipped,
        audioFilesTranscribed: audioTranscripts.filter((a) => a.status === "transcribed").length,
        imageFilesFound: imageFiles.length,
        unsupportedFiles,
        dateRange: parseResult.dateRange,
        participants: parseResult.participants,
        ...(largeTextSummary ? { largeTextSummary } : {}),
        ...(isLargeTxt
          ? {
              largeTextProcessing: {
                isLargeTxt: true,
                txtSizeMb: Number((chatContentSizeBytes / (1024 * 1024)).toFixed(2)),
                chunkCount,
                strategy: "chunking_condicional",
              },
            }
          : {}),
        warnings: [
          ...parseResult.warnings,
          ...(isLargeTxt ? [`info:Fluxo de arquivo grande ativado. TXT com ${(chatContentSizeBytes / (1024 * 1024)).toFixed(2)}MB processado em ${chunkCount} chunks.`] : []),
          ...(videosIgnored > 0 ? [`info:Vídeos não são considerados na análise comportamental. ${videosIgnored === 1 ? 'Foi detectado 1 vídeo' : `Foram detectados ${videosIgnored} vídeos`} na conversa.`] : []),
          ...(audiosSkipped > 0 ? [`info:${audiosSkipped === 1 ? '1 áudio excedeu' : `${audiosSkipped} áudios excederam`} o limite de ${MAX_AUDIO_SIZE / (1024 * 1024)}MB e ${audiosSkipped === 1 ? 'não foi transcrito' : 'não foram transcritos'}.`] : []),
          ...(docsIgnored > 0 ? [`info:${docsIgnored === 1 ? '1 documento detectado' : `${docsIgnored} documentos detectados`} na conversa. Documentos não são processados na análise.`] : []),
        ],
      };

      const mediaSummary: WhatsAppMediaSummary = {
        audioTranscripts,
        images: imageFiles.map((f) => ({
          fileName: f,
          referencedInChat: parseResult.messages.some(
            (m) => m.mediaFileName === f || m.text.includes(f)
          ),
          status: "ignored" as const,
        })),
        skippedFiles,
      };

      // Update call
      await updateCall(callId, {
        sourceType: "whatsapp_export",
        transcript: transcriptForStorage,
        status: "transcribed",
        whatsappImportData: importData,
        whatsappMediaSummary: mediaSummary,
      });

      console.log(
        `[WhatsApp] Call ${callId} updated: zip=${(file.size / (1024 * 1024)).toFixed(2)}MB txt=${(chatContentSizeBytes / (1024 * 1024)).toFixed(2)}MB msgs=${parseResult.messages.length} audios=${audioTranscripts.filter((a) => a.status === "transcribed").length}/${audioFiles.length} skippedVideos=${videosIgnored} skippedDocs=${docsIgnored} chunks=${chunkCount}`
      );

      return res.json({
        success: true,
        callId,
        transcript: transcriptForStorage,
        importData,
        mediaSummary,
      });
    } catch (error: any) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `Arquivo muito grande. Tamanho máximo: ${ZIP_MAX_SIZE / (1024 * 1024)}MB`,
        });
      }
      console.error("[WhatsApp] Error:", error.message);
      return res.status(500).json({ error: error.message || "Erro ao processar arquivo WhatsApp" });
    } finally {
      if (uploadedFilePath) {
        await fs.unlink(uploadedFilePath).catch(() => {});
      }
    }
  }
);

export default router;
