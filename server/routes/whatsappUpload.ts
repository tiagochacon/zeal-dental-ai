/**
 * WhatsApp Export Upload Route
 * Accepts .zip files exported from WhatsApp, extracts _chat.txt,
 * transcribes audio files, and builds a unified transcript.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { getCallById, updateCall, getUserById } from "../db";
import { sdk } from "../_core/sdk";
import { parseWhatsAppChat, buildUnifiedTranscript } from "../helpers/whatsappExportParser";
import { transcribeAudio } from "../_core/voiceTranscription";
import type { WhatsAppImportData, WhatsAppMediaSummary } from "../../drizzle/schema";

const ZIP_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const SINGLE_FILE_MAX = 25 * 1024 * 1024; // 25MB per internal file
const AUDIO_EXTENSIONS = [".opus", ".ogg", ".m4a", ".mp3", ".wav", ".aac"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".com", ".vbs", ".js"];

const upload = multer({
  storage: multer.memoryStorage(),
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

router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
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
        zip = await JSZip.loadAsync(file.buffer);
      } catch {
        return res.status(400).json({ error: "Arquivo ZIP inválido ou corrompido" });
      }

      // Find _chat.txt
      let chatContent: string | null = null;
      let chatFileName: string | null = null;
      const audioFiles: Array<{ name: string; buffer: Buffer; ext: string }> = [];
      const imageFiles: string[] = [];
      const skippedFiles: Array<{ fileName: string; reason: string }> = [];
      const unsupportedFiles: string[] = [];

      for (const [entryName, entry] of Object.entries(zip.files)) {
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

        // Find chat file
        if (
          (safeName.includes("_chat") && ext === ".txt") ||
          safeName === "chat.txt" ||
          safeName.toLowerCase() === "_chat.txt"
        ) {
          try {
            const buf = await entry.async("nodebuffer");
            // Try UTF-8 first, fallback to latin1
            try {
              chatContent = buf.toString("utf-8");
              // Check for BOM and encoding issues
              if (chatContent.startsWith("\ufeff")) {
                chatContent = chatContent.slice(1);
              }
            } catch {
              chatContent = buf.toString("latin1");
            }
            chatFileName = safeName;
          } catch {
            skippedFiles.push({ fileName: safeName, reason: "Erro ao ler arquivo de chat" });
          }
          continue;
        }

        // Collect audio files
        if (AUDIO_EXTENSIONS.includes(ext)) {
          try {
            const buf = await entry.async("nodebuffer");
            if (buf.length > SINGLE_FILE_MAX) {
              skippedFiles.push({ fileName: safeName, reason: `Áudio muito grande (${(buf.length / (1024 * 1024)).toFixed(1)}MB)` });
            } else {
              audioFiles.push({ name: safeName, buffer: buf, ext });
            }
          } catch {
            skippedFiles.push({ fileName: safeName, reason: "Erro ao extrair áudio" });
          }
          continue;
        }

        // Collect image files (just register, no processing)
        if (IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(safeName);
          continue;
        }

        // Skip other files
        if (ext !== ".txt") {
          unsupportedFiles.push(safeName);
        }
      }

      if (!chatContent || !chatFileName) {
        return res.status(400).json({
          error: "Arquivo _chat.txt não encontrado no ZIP. Certifique-se de exportar a conversa pelo WhatsApp.",
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

      // Count messages by role
      const leadMessages = parseResult.messages.filter((m) => m.speakerRole === "lead").length;
      const crcMessages = parseResult.messages.filter((m) => m.speakerRole === "crc").length;

      // Build import data
      const importData: WhatsAppImportData = {
        fileName: file.originalname,
        importedAt: new Date().toISOString(),
        chatFileName,
        totalMessages: parseResult.messages.filter((m) => m.messageType !== "system").length,
        leadMessages,
        crcMessages,
        audioFilesFound: audioFiles.length,
        audioFilesTranscribed: audioTranscripts.filter((a) => a.status === "transcribed").length,
        imageFilesFound: imageFiles.length,
        unsupportedFiles,
        dateRange: parseResult.dateRange,
        participants: parseResult.participants,
        warnings: parseResult.warnings,
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
        transcript,
        status: "transcribed",
        whatsappImportData: importData,
        whatsappMediaSummary: mediaSummary,
      });

      console.log(`[WhatsApp] Call ${callId} updated: ${parseResult.messages.length} msgs, ${audioTranscripts.filter((a) => a.status === "transcribed").length}/${audioFiles.length} audios transcribed`);

      return res.json({
        success: true,
        callId,
        transcript,
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
    }
  }
);

export default router;
