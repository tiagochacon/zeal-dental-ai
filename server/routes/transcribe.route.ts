import { Router } from "express";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { storagePut } from "../storage";
import {
  createAudioChunk,
  updateAudioChunkTranscript,
  updateAudioChunkStatus,
  getAudioChunksBySession,
} from "../db";
import { nanoid } from "nanoid";

export const transcribeRouter = Router();

const DENTAL_PROMPT =
  "Transcrição de consulta odontológica clínica. Vocabulário esperado: cárie, restauração, canal, extração, implante, prótese, periodontia, ortodontia, radiografia, anestesia, dente 16, dente 21, FDI, SOAP, diagnóstico, plano de tratamento, hipótese diagnóstica, gengivite, molar, incisivo, obturação, profilaxia, clareamento, bruxismo, oclusão, endodontia. Diálogo entre dentista e paciente. Português brasileiro.";

// ─── POST /api/transcribe-chunk ───────────────────────────────────────────────
// Receives a single audio chunk (base64), uploads to S3, saves to DB,
// transcribes via Forge API (Whisper), and returns transcript.
// Called progressively while recording is still in progress.
transcribeRouter.post("/transcribe-chunk", async (req, res) => {
  // Auth check
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const {
    audioBase64,
    mimeType,
    consultationId,
    recordingSessionId,
    chunkIndex,
    durationSeconds,
  } = req.body as {
    audioBase64: string;
    mimeType: string;
    consultationId: number;
    recordingSessionId: string;
    chunkIndex: number;
    durationSeconds?: number;
  };

  if (!audioBase64 || consultationId == null || !recordingSessionId || chunkIndex == null) {
    return res.status(400).json({
      error: "audioBase64, consultationId, recordingSessionId e chunkIndex são obrigatórios",
    });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const sizeBytes = audioBuffer.length;

    console.log(
      `[TranscribeChunk] Chunk ${chunkIndex} for consultation ${consultationId}: ${(sizeBytes / 1024).toFixed(1)}KB, type: ${mimeType}`
    );

    // Skip silence/noise (< 1KB)
    if (sizeBytes < 1024) {
      console.log(`[TranscribeChunk] Chunk ${chunkIndex} too small (${sizeBytes}B), skipping`);
      return res.json({ transcript: "", chunkIndex, status: "done" });
    }

    // 1. Upload chunk to S3
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const fileKey = `consultations/${user.id}/${consultationId}/chunks/${recordingSessionId}/chunk-${chunkIndex}-${nanoid(6)}.${ext}`;
    const { url: chunkUrl } = await storagePut(fileKey, audioBuffer, mimeType);

    console.log(`[TranscribeChunk] Chunk ${chunkIndex} uploaded to S3: ${fileKey}`);

    // 2. Save chunk metadata to DB
    await createAudioChunk({
      consultationId,
      recordingSessionId,
      chunkIndex,
      fileKey,
      url: chunkUrl,
      mimeType,
      sizeBytes,
      durationSeconds: durationSeconds || null,
      transcriptionStatus: "transcribing",
    });

    // 3. Transcribe via Forge API (same as transcribeAudioDirect)
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      await updateAudioChunkStatus(consultationId, recordingSessionId, chunkIndex, "error", "Forge API not configured");
      return res.status(500).json({ error: "Serviço de transcrição não configurado" });
    }

    const formData = new FormData();
    const filename = `chunk_${chunkIndex}.${ext}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");
    formData.append("language", "pt");
    formData.append("prompt", DENTAL_PROMPT);

    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    const whisperRes = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => "");
      const errorMsg = `Whisper ${whisperRes.status}: ${whisperRes.statusText} ${errBody}`;
      console.error(`[TranscribeChunk] Chunk ${chunkIndex} failed:`, errorMsg);
      await updateAudioChunkStatus(consultationId, recordingSessionId, chunkIndex, "error", errorMsg);
      return res.status(502).json({ error: errorMsg, chunkIndex, status: "error" });
    }

    // response_format=text returns plain string
    const transcript = (await whisperRes.text()).trim();

    console.log(
      `[TranscribeChunk] Chunk ${chunkIndex} transcribed: ${transcript.length} chars, preview: "${transcript.substring(0, 80)}..."`
    );

    // 4. Update DB with transcript
    await updateAudioChunkTranscript(consultationId, recordingSessionId, chunkIndex, transcript);

    return res.json({ transcript, chunkIndex, status: "done" });
  } catch (err: any) {
    console.error(`[TranscribeChunk] Chunk ${chunkIndex} error:`, err);
    try {
      await updateAudioChunkStatus(
        consultationId, recordingSessionId, chunkIndex, "error",
        err?.message ?? "Erro interno"
      );
    } catch (_) { /* ignore DB error during error handling */ }
    return res.status(500).json({ error: err?.message ?? "Erro interno", chunkIndex, status: "error" });
  }
});

// ─── GET /api/transcribe-chunk/status ─────────────────────────────────────────
// Returns the transcription status of all chunks for a session
transcribeRouter.get("/transcribe-chunk/status", async (req, res) => {
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const consultationId = Number(req.query.consultationId);
  const recordingSessionId = req.query.recordingSessionId as string;

  if (!consultationId || !recordingSessionId) {
    return res.status(400).json({ error: "consultationId e recordingSessionId são obrigatórios" });
  }

  try {
    const chunks = await getAudioChunksBySession(consultationId, recordingSessionId);
    const result = chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      status: c.transcriptionStatus,
      transcript: c.transcriptText || "",
      error: c.transcriptionError || null,
    }));
    return res.json({ chunks: result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno" });
  }
});
