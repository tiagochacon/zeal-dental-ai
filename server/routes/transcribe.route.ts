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

// Short prompt — frases longas causam alucinação no Whisper (ele repete o prompt)
const DENTAL_PROMPT =
  "Consulta odontológica. Português brasileiro. Termos: cárie, restauração, canal, extração, implante, prótese, anestesia, SOAP, diagnóstico, plano de tratamento.";

// Markers de alucinação do Whisper — quando aparece isso, o transcript é inválido
const HALLUCINATION_MARKERS = [
  "diálogo entre dentista e paciente",
  "transcrição de consulta odontológica clínica",
  "consulta odontológica. português brasileiro.",
  "vocabulário esperado",
];

// ─── Context chaining ─────────────────────────────────────────────────────────
// Busca as últimas 30 palavras do chunk anterior para usar como contexto no Whisper.
// Isso evita alucinações no início de cada chunk e mantém continuidade no texto.
async function getPreviousChunkContext(
  consultationId: number,
  recordingSessionId: string,
  chunkIndex: number
): Promise<string> {
  if (chunkIndex === 0) return "";
  try {
    const chunks = await getAudioChunksBySession(consultationId, recordingSessionId);
    const prev = chunks.find(
      (c) =>
        c.chunkIndex === chunkIndex - 1 &&
        c.transcriptionStatus === "done" &&
        c.transcriptText
    );
    if (!prev?.transcriptText) return "";
    const words = prev.transcriptText.trim().split(/\s+/);
    return words.slice(-30).join(" ");
  } catch (err) {
    console.warn("[TranscribeChunk] Falha ao buscar contexto do chunk anterior:", err);
    return "";
  }
}

// ─── Hallucination detection ─────────────────────────────────────────────────
type WhisperSegmentLocal = {
  no_speech_prob: number;
  avg_logprob: number;
  text: string;
};
type WhisperVerboseResponse = {
  text: string;
  segments?: WhisperSegmentLocal[];
};

function detectHallucination(
  transcript: string,
  segments: WhisperSegmentLocal[]
): { isHallucination: boolean; reason: string } {
  if (segments.length > 0) {
    const avgNoSpeechProb =
      segments.reduce((s, seg) => s + seg.no_speech_prob, 0) / segments.length;
    const avgLogProb =
      segments.reduce((s, seg) => s + seg.avg_logprob, 0) / segments.length;

    if (avgNoSpeechProb > 0.8) {
      return {
        isHallucination: true,
        reason: `silêncio (no_speech_prob=${avgNoSpeechProb.toFixed(2)})`,
      };
    }
    if (avgLogProb < -1.0 && avgNoSpeechProb > 0.5) {
      return {
        isHallucination: true,
        reason: `qualidade muito baixa (avg_logprob=${avgLogProb.toFixed(2)})`,
      };
    }
  }

  // Detectar repetição do prompt (alucinação clássica do Whisper)
  if (
    transcript.length < 400 &&
    HALLUCINATION_MARKERS.some((marker) =>
      transcript.toLowerCase().includes(marker)
    )
  ) {
    return {
      isHallucination: true,
      reason: "repetição do prompt (alucinação do Whisper)",
    };
  }

  return { isHallucination: false, reason: "" };
}

// ─── POST /api/transcribe-chunk ───────────────────────────────────────────────
// Receives a single audio chunk (base64), uploads to S3, saves to DB,
// normalizes to MP3, transcribes via Forge API (Whisper), and returns transcript.
// Called progressively while recording is still in progress.
transcribeRouter.post("/", async (req, res) => {
  // Auth check
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
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

  if (
    !audioBase64 ||
    consultationId == null ||
    !recordingSessionId ||
    chunkIndex == null
  ) {
    return res.status(400).json({
      error:
        "audioBase64, consultationId, recordingSessionId e chunkIndex são obrigatórios",
    });
  }

  const rawBuffer = Buffer.from(audioBase64, "base64");
  const rawSizeBytes = rawBuffer.length;

  console.log(
    `[TranscribeChunk] Chunk ${chunkIndex} for consultation ${consultationId}: ${(rawSizeBytes / 1024).toFixed(1)}KB, type: ${mimeType}`
  );

  // Skip silence/noise (< 1KB)
  if (rawSizeBytes < 1024) {
    console.log(
      `[TranscribeChunk] Chunk ${chunkIndex} too small (${rawSizeBytes}B), skipping`
    );
    return res.json({ transcript: "", chunkIndex, status: "done" });
  }

  // ─── STEP 1: Upload raw chunk to S3 (fatal — sem S3 não tem como recuperar) ─
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const fileKey = `consultations/${user.id}/${consultationId}/chunks/${recordingSessionId}/chunk-${chunkIndex}-${nanoid(6)}.${ext}`;
  let chunkUrl: string;
  try {
    const uploaded = await storagePut(fileKey, rawBuffer, mimeType);
    chunkUrl = uploaded.url;
    console.log(`[TranscribeChunk] Chunk ${chunkIndex} uploaded to S3: ${fileKey}`);
  } catch (s3Err: any) {
    console.error(`[TranscribeChunk] S3 upload failed for chunk ${chunkIndex}:`, s3Err?.message);
    return res.status(500).json({
      error: `Falha no upload do áudio: ${s3Err?.message ?? "Erro S3"}`,
      chunkIndex,
      status: "error",
    });
  }

  // ─── STEP 2: Save chunk metadata to DB (non-fatal — RLS ou erro de banco não
  // deve impedir a transcrição. O áudio já está no S3 e pode ser recuperado.) ──
  try {
    await createAudioChunk({
      consultationId,
      recordingSessionId,
      chunkIndex,
      fileKey,
      url: chunkUrl,
      mimeType,
      sizeBytes: rawSizeBytes,
      durationSeconds: durationSeconds || null,
      transcriptionStatus: "transcribing",
    });
  } catch (dbErr: any) {
    console.error(
      `[TranscribeChunk] Falha ao salvar chunk ${chunkIndex} no banco (RLS?): ${dbErr?.message}. Continuando com transcrição.`
    );
    // NÃO retornar erro — continuar com a transcrição mesmo sem persistência no DB
  }

  // ─── STEP 3: Use raw WebM buffer (Whisper accepts WebM natively) ─
  // Whisper pode transcrever WebM bruto do MediaRecorder sem normalização
  const audioBuffer = rawBuffer;
  const normalizedMimeType = mimeType;

  // ─── STEP 4: Check Forge API config ──────────────────────────────────────────
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    try {
      await updateAudioChunkStatus(
        consultationId,
        recordingSessionId,
        chunkIndex,
        "error",
        "Forge API not configured"
      );
    } catch {}
    return res.status(500).json({ error: "Serviço de transcrição não configurado" });
  }

  // ─── STEP 5: Build prompt with context from previous chunk ────────────────────
  const previousContext = await getPreviousChunkContext(
    consultationId,
    recordingSessionId,
    chunkIndex
  );
  const chunkPrompt = previousContext
    ? `${previousContext} ${DENTAL_PROMPT}`
    : DENTAL_PROMPT;

  if (previousContext) {
    console.log(
      `[TranscribeChunk] Chunk ${chunkIndex}: usando contexto anterior (${previousContext.split(" ").length} palavras)`
    );
  }

  // ─── STEP 6: Call Whisper API (verbose_json for hallucination detection) ──────
  const normalizedExt = normalizedMimeType.includes("mp4") ? "mp4" : "mp3";
  const formData = new FormData();
  const filename = `chunk_${chunkIndex}.${normalizedExt}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
    type: normalizedMimeType,
  });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("language", "pt");
  formData.append("prompt", chunkPrompt);

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

  let whisperRes: Response;
  try {
    whisperRes = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });
  } catch (fetchErr: any) {
    const errorMsg = `Falha de rede ao chamar Whisper: ${fetchErr?.message}`;
    console.error(`[TranscribeChunk] Chunk ${chunkIndex}:`, errorMsg);
    try {
      await updateAudioChunkStatus(
        consultationId,
        recordingSessionId,
        chunkIndex,
        "error",
        errorMsg
      );
    } catch {}
    return res.status(502).json({ error: errorMsg, chunkIndex, status: "error" });
  }

  if (!whisperRes.ok) {
    const errBody = await whisperRes.text().catch(() => "");
    const errorMsg = `Whisper ${whisperRes.status}: ${whisperRes.statusText} ${errBody}`;
    console.error(`[TranscribeChunk] Chunk ${chunkIndex} failed:`, errorMsg);
    try {
      await updateAudioChunkStatus(
        consultationId,
        recordingSessionId,
        chunkIndex,
        "error",
        errorMsg
      );
    } catch {}
    return res.status(502).json({ error: errorMsg, chunkIndex, status: "error" });
  }

  // ─── STEP 7: Parse verbose_json + detect hallucination ────────────────────────
  const rawResponse = (await whisperRes.text()).trim();

  let whisperData: WhisperVerboseResponse;
  try {
    whisperData = JSON.parse(rawResponse) as WhisperVerboseResponse;
  } catch {
    // Fallback se não for JSON válido (Forge API às vezes ignora response_format)
    whisperData = { text: rawResponse, segments: [] };
  }

  let transcript = (whisperData.text || "").trim();
  const segments = whisperData.segments || [];

  const { isHallucination, reason: hallucinationReason } = detectHallucination(
    transcript,
    segments
  );

  if (isHallucination) {
    console.warn(
      `[TranscribeChunk] Chunk ${chunkIndex}: alucinação/silêncio detectado (${hallucinationReason}). Salvando vazio.`
    );
    transcript = "";
  }

  console.log(
    `[TranscribeChunk] Chunk ${chunkIndex} processado: ${transcript.length} chars` +
      (hallucinationReason ? ` [DESCARTADO: ${hallucinationReason}]` : "")
  );

  // ─── STEP 8: Update DB with transcript (non-fatal) ────────────────────────────
  try {
    await updateAudioChunkTranscript(
      consultationId,
      recordingSessionId,
      chunkIndex,
      transcript
    );
  } catch (dbErr: any) {
    console.error(
      `[TranscribeChunk] Falha ao salvar transcript do chunk ${chunkIndex} no banco: ${dbErr?.message}`
    );
    // NÃO bloquear resposta — o transcript já foi gerado
  }

  return res.json({ transcript, chunkIndex, status: "done" });
});

// ─── GET /api/transcribe-chunk/status ─────────────────────────────────────────
// Returns the transcription status of all chunks for a session
transcribeRouter.get("/status", async (req, res) => {
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const consultationId = Number(req.query.consultationId);
  const recordingSessionId = req.query.recordingSessionId as string;

  if (!consultationId || !recordingSessionId) {
    return res.status(400).json({
      error: "consultationId e recordingSessionId são obrigatórios",
    });
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
