/**
 * Audio Upload Route - Multipart file upload for call recordings
 * Supports files up to 100MB (covers 30min WAV files)
 * Bypasses Express JSON body parser limit by using multer for multipart
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { getCallById, updateCall, getUserById } from "../db";
import { sdk } from "../_core/sdk";

const AUDIO_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes

const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
];

// Configure multer for memory storage with size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AUDIO_MAX_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato de áudio não suportado: ${file.mimetype}`));
    }
  },
});

const router = Router();

/**
 * POST /api/calls/upload-audio
 * Multipart form upload for call audio files
 * Fields:
 *   - file: audio file (required)
 *   - callId: number (required)
 *   - durationSeconds: number (optional)
 */
router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Authenticate user
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

      // Validate file
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo de áudio enviado" });
      }

      // Validate callId
      const callId = parseInt(req.body.callId);
      if (!callId || isNaN(callId)) {
        return res.status(400).json({ error: "ID da ligação inválido" });
      }

      // Validate duration
      const durationSeconds = req.body.durationSeconds ? parseInt(req.body.durationSeconds) : null;
      if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS) {
        return res.status(400).json({ 
          error: `Duração máxima permitida: ${MAX_DURATION_SECONDS / 60} minutos` 
        });
      }

      // Verify call belongs to user's clinic
      const call = await getCallById(callId);
      if (!call || call.clinicId !== user.clinicId) {
        return res.status(404).json({ error: "Ligação não encontrada" });
      }

      // Determine file extension
      const mimeType = file.mimetype;
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/aac": "aac",
        "audio/flac": "flac",
      };
      const ext = extMap[mimeType] || "audio";

      // Upload to S3
      const fileKey = `calls/${user.id}/${callId}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(fileKey, file.buffer, mimeType);

      // Update call record
      await updateCall(callId, {
        audioUrl: url,
        audioFileKey: fileKey,
        audioDurationSeconds: durationSeconds,
      });

      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[AudioUpload] Call ${callId}: ${sizeMB}MB ${ext} uploaded successfully`);

      return res.json({ 
        success: true, 
        audioUrl: url,
        fileSize: file.size,
        mimeType,
        durationSeconds,
      });
    } catch (error: any) {
      // Handle multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ 
          error: `Arquivo muito grande. Tamanho máximo: ${AUDIO_MAX_SIZE / (1024 * 1024)}MB` 
        });
      }
      console.error("[AudioUpload] Error:", error.message);
      return res.status(500).json({ error: error.message || "Erro ao fazer upload do áudio" });
    }
  }
);

export default router;
