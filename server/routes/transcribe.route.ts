import { Router } from "express";
import { sdk } from "../_core/sdk";

export const transcribeRouter = Router();

// ─── POST /api/transcribe-chunk ───────────────────────────────────────────────
// Receives a single audio chunk (base64) and returns its transcript.
// Called progressively while recording is still in progress.
transcribeRouter.post("/transcribe-chunk", async (req, res) => {
  // Auth check
  let user = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const { audioBase64, fileName, mimeType } = req.body as {
    audioBase64: string;
    fileName: string;
    mimeType: string;
  };

  if (!audioBase64 || !fileName) {
    return res.status(400).json({ error: "audioBase64 e fileName são obrigatórios" });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!openAiApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY não configurada" });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Validate minimum size — chunks < 1KB are silence/noise, skip them
    if (audioBuffer.length < 1024) {
      return res.json({ transcript: "" });
    }

    // Build multipart form for Whisper
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioBuffer], { type: mimeType ?? "audio/webm" }),
      fileName
    );
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    // Ask Whisper to output plain text (no timestamps)
    formData.append("response_format", "text");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiApiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text();
      console.error("Whisper error:", errBody);
      return res.status(502).json({ error: `Whisper: ${whisperRes.statusText}` });
    }

    // response_format=text returns plain string, not JSON
    const transcript = (await whisperRes.text()).trim();
    return res.json({ transcript });
  } catch (err: any) {
    console.error("transcribe-chunk error:", err);
    return res.status(500).json({ error: err?.message ?? "Erro interno" });
  }
});
