/**
 * Consultation Audio Upload Route - Multipart file upload for consultation recordings
 * Supports files up to 1.5GB (covers 90min WAV files)
 * Bypasses Express JSON body parser limit by using multer for multipart
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { getConsultationById, updateConsultation, getUserById } from "../db";
import { sdk } from "../_core/sdk";

const AUDIO_MAX_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const MAX_DURATION_SECONDS = 90 * 60; // 90 minutes

const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
];

// Use disk storage for large files to avoid memory issues
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmpDir = path.join(os.tmpdir(), 'zeal-consultation-upload');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.audio';
    cb(null, `upload_${nanoid(12)}${ext}`);
  },
});

const upload = multer({
  storage,
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
 * POST /api/consultations/upload-audio
 * Multipart form upload for consultation audio files (up to 1.5GB)
 * Fields:
 *   - file: audio file (required)
 *   - consultationId: number (required)
 *   - durationSeconds: number (optional)
 */
router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    let tmpFilePath: string | null = null;

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

      tmpFilePath = file.path;

      // Validate consultationId
      const consultationId = parseInt(req.body.consultationId);
      if (!consultationId || isNaN(consultationId)) {
        return res.status(400).json({ error: "ID da consulta inválido" });
      }

      // Validate duration
      const durationSeconds = req.body.durationSeconds ? parseInt(req.body.durationSeconds) : null;
      if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS) {
        return res.status(400).json({
          error: `Duração máxima permitida: ${MAX_DURATION_SECONDS / 60} minutos`
        });
      }

      // Verify consultation belongs to user (dentist) or user's clinic
      const consultation = await getConsultationById(consultationId);
      if (!consultation) {
        return res.status(404).json({ error: "Consulta não encontrada" });
      }
      // Check access: user is the dentist OR user is in the same clinic
      const isDentist = consultation.dentistId === user.id;
      // For clinic-level access, we need to check if the dentist belongs to the same clinic
      if (!isDentist && user.clinicId) {
        const dentist = await getUserById(consultation.dentistId);
        if (!dentist || dentist.clinicId !== user.clinicId) {
          return res.status(404).json({ error: "Consulta não encontrada" });
        }
      } else if (!isDentist) {
        return res.status(404).json({ error: "Consulta não encontrada" });
      }

      // Determine file extension
      const mimeType = file.mimetype;
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/x-wav": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/aac": "aac",
        "audio/flac": "flac",
      };
      const ext = extMap[mimeType] || "audio";

      // Read file from disk and upload to S3
      const fileBuffer = await fs.promises.readFile(file.path);
      const fileKey = `consultations/${user.clinicId}/${consultationId}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, mimeType);

      // Update consultation record
      await updateConsultation(consultationId, {
        audioUrl: url,
        audioFileKey: fileKey,
        audioDurationSeconds: durationSeconds,
      });

      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[ConsultationAudioUpload] Consultation ${consultationId}: ${sizeMB}MB ${ext} uploaded successfully`);

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
          error: `Arquivo muito grande. Tamanho máximo: ${(AUDIO_MAX_SIZE / (1024 * 1024 * 1024)).toFixed(1)}GB`
        });
      }
      console.error("[ConsultationAudioUpload] Error:", error.message);
      return res.status(500).json({ error: error.message || "Erro ao fazer upload do áudio" });
    } finally {
      // Cleanup temp file
      if (tmpFilePath) {
        try {
          await fs.promises.unlink(tmpFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
);

export default router;
