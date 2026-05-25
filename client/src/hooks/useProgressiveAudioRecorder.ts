import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface ChunkTranscription {
  index: number;
  status: "pending" | "uploading" | "transcribing" | "done" | "error";
  text: string;
  error?: string;
}

export type ChunkStatus = ChunkTranscription["status"];

export interface ProgressiveRecorderOptions {
  /** Consultation ID to associate chunks with */
  consultationId: number;
  /** Tamanho de cada chunk em ms. Padrão: 60000 (60s) */
  chunkDurationMs?: number;
  /** Chamado quando um chunk termina de ser transcrito */
  onChunkTranscribed?: (chunk: ChunkTranscription) => void;
  /** Chamado quando um erro ocorre em um chunk */
  onChunkError?: (chunk: ChunkTranscription) => void;
}

function generateSessionId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const IN_FLIGHT_STATUSES: ChunkStatus[] = ["pending", "uploading", "transcribing"];
const ASSEMBLE_MAX_WAIT_MS = 90_000;
const ASSEMBLE_POLL_INTERVAL_MS = 250;

// Textos que indicam alucinação do Whisper — filtrados na montagem final
const HALLUCINATION_MARKERS = [
  "diálogo entre dentista e paciente",
  "transcrição de consulta odontológica clínica",
  "consulta odontológica. português brasileiro.",
  "vocabulário esperado",
];

export function hasInFlightChunks(chunks: ChunkTranscription[]): boolean {
  return chunks.some((chunk) => IN_FLIGHT_STATUSES.includes(chunk.status));
}

export function countErroredChunks(chunks: ChunkTranscription[]): number {
  return chunks.filter((chunk) => chunk.status === "error").length;
}

export function buildTranscriptFromChunks(chunks: ChunkTranscription[]): string {
  return [...chunks]
    .sort((a, b) => a.index - b.index)
    .filter((chunk) => chunk.status === "done")
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .filter((text) => {
      const lower = text.toLowerCase();
      const isHallucination =
        text.length < 300 &&
        HALLUCINATION_MARKERS.some((marker) => lower.includes(marker));
      return !isHallucination;
    })
    .join("\n\n");
}

/**
 * Send chunk to backend: uploads to S3 + transcribes via Forge API (Whisper)
 * Includes retry with exponential backoff for transient failures.
 */
async function transcribeChunkRequest(
  blob: Blob,
  mimeType: string,
  index: number,
  consultationId: number,
  recordingSessionId: string,
  durationSeconds?: number
): Promise<string> {
  const base64 = await blobToBase64(blob);
  const payload = JSON.stringify({
    audioBase64: base64,
    mimeType,
    consultationId,
    recordingSessionId,
    chunkIndex: index,
    durationSeconds,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[Chunk ${index}] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch("/api/transcribe-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      // If we got HTML back (413 Payload Too Large, 502 Bad Gateway, etc.), retry
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        lastError = new Error(`Servidor retornou ${res.status} (não-JSON). Tentativa ${attempt + 1}/${MAX_RETRIES + 1}`);
        console.warn(`[Chunk ${index}] Non-JSON response (${res.status}):`, text.substring(0, 200));
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const msg = (err as any).error ?? "Falha na transcrição";

        // Classificar erro para mensagem mais clara ao usuário
        let friendlyMsg = msg;
        if (
          msg.includes("RLS") ||
          msg.includes("violates") ||
          msg.includes("security policy") ||
          msg.includes("row-level")
        ) {
          friendlyMsg =
            "Erro de banco de dados (RLS ativo). Verifique as configurações do Supabase.";
        } else if (
          msg.includes("Forge") ||
          msg.includes("Whisper") ||
          msg.includes("transcri")
        ) {
          friendlyMsg = "Erro no serviço de transcrição. Tentando novamente...";
        }

        // Retry on server errors (5xx), don't retry on client errors (4xx)
        if (res.status >= 500) {
          lastError = new Error(friendlyMsg);
          continue;
        }
        throw new Error(friendlyMsg);
      }

      const data = await res.json();
      return (data as any).transcript as string;
    } catch (err: any) {
      // Network errors are retryable
      if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`Falha após ${MAX_RETRIES + 1} tentativas`);
}

export function useProgressiveAudioRecorder(options: ProgressiveRecorderOptions) {
  const {
    consultationId,
    chunkDurationMs = 60_000,
    onChunkTranscribed,
    onChunkError,
  } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkTranscription[]>([]);
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [finalizationWarning, setFinalizationWarning] = useState<string | null>(null);
  // Fix 1+4: Track whether the last chunk from stop() has been queued
  const [isLastChunkQueued, setIsLastChunkQueued] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const allRawBlobsRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string>("");
  const segmentStartTimeRef = useRef<number>(0);
  const chunksRef = useRef<ChunkTranscription[]>([]);
  // Serial queue: transcriptions go in order
  const transcriptionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef<RecordingState>("idle");
  // Fix 1: Promise that resolves when stop()'s onstop handler has finished dispatching the last chunk
  const stopCompleteResolveRef = useRef<(() => void) | null>(null);
  const stopCompletePromiseRef = useRef<Promise<void>>(Promise.resolve());

  const setStateSync = (s: RecordingState) => {
    stateRef.current = s;
    setState(s);
  };

  const setChunksSync = useCallback(
    (updater: ChunkTranscription[] | ((prev: ChunkTranscription[]) => ChunkTranscription[])) => {
      setChunks((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        chunksRef.current = next;
        return next;
      });
    },
    []
  );

  // ─── Update a chunk in state ─────────────────────────────────────────────────
  const updateChunk = useCallback(
    (index: number, update: Partial<ChunkTranscription>) => {
      setChunksSync((prev) =>
        prev.map((chunk) => (chunk.index === index ? { ...chunk, ...update } : chunk))
      );
    },
    [setChunksSync]
  );

  const markInFlightChunksAsError = useCallback(
    (reason: string) => {
      setChunksSync((prev) =>
        prev.map((chunk) =>
          IN_FLIGHT_STATUSES.includes(chunk.status)
            ? { ...chunk, status: "error", text: "", error: reason }
            : chunk
        )
      );
    },
    [setChunksSync]
  );

  // ─── Dispatch blob → queue upload + transcription ───────────────────────────
  const dispatchChunkBlob = useCallback(
    (blob: Blob, index: number, segmentDurationMs: number) => {
      setChunksSync((prev) => [...prev, { index, status: "uploading", text: "" }]);

      const sessionId = sessionIdRef.current;
      const durationSec = Math.round(segmentDurationMs / 1000);

      transcriptionQueueRef.current = transcriptionQueueRef.current.then(async () => {
        updateChunk(index, { status: "transcribing" });
        try {
          const text = await transcribeChunkRequest(
            blob,
            mimeTypeRef.current,
            index,
            consultationId,
            sessionId,
            durationSec
          );
          updateChunk(index, { status: "done", text });
          onChunkTranscribed?.({ index, status: "done", text });
        } catch (err: any) {
          const error = err?.message ?? "Erro desconhecido";
          updateChunk(index, { status: "error", text: "", error });
          onChunkError?.({ index, status: "error", text: "", error });
        }
      });
    },
    [consultationId, onChunkTranscribed, onChunkError, setChunksSync, updateChunk]
  );

  // ─── Start a fresh MediaRecorder segment ────────────────────────────────────
  const startSegment = useCallback(
    (stream: MediaStream) => {
      const segmentBlobs: Blob[] = [];
      segmentStartTimeRef.current = Date.now();

      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          segmentBlobs.push(e.data);
          allRawBlobsRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (segmentBlobs.length === 0) return;
        const blob = new Blob(segmentBlobs, { type: mimeTypeRef.current });
        const segmentDuration = Date.now() - segmentStartTimeRef.current;
        dispatchChunkBlob(blob, chunkIndexRef.current++, segmentDuration);

        // Auto-restart if still recording
        if (stateRef.current === "recording" && streamRef.current) {
          startSegment(streamRef.current);
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
    },
    [dispatchChunkBlob]
  );

  // ─── Flush current segment early ───────────────────────────────────────────
  const flushSegment = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  // ─── start() ────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      streamRef.current = stream;
      allRawBlobsRef.current = [];
      chunkIndexRef.current = 0;
      sessionIdRef.current = generateSessionId();
      transcriptionQueueRef.current = Promise.resolve();
      stopCompletePromiseRef.current = Promise.resolve();
      stopCompleteResolveRef.current = null;

      chunksRef.current = [];
      setChunks([]);
      setFinalTranscript(null);
      setFinalizationWarning(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      setIsLastChunkQueued(true); // No pending stop yet

      mimeTypeRef.current = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      setStateSync("recording");
      startSegment(stream);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      chunkTimerRef.current = setInterval(flushSegment, chunkDurationMs);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      throw err;
    }
  }, [chunkDurationMs, startSegment, flushSegment]);

  // ─── stop() — Fix 1: returns Promise<void> that resolves after onstop dispatches last chunk ───
  const stop = useCallback((): Promise<void> => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

    setStateSync("stopped");
    // Fix 4: Mark that the last chunk is NOT yet queued
    setIsLastChunkQueued(false);

    const recorder = mediaRecorderRef.current;

    // Edge case: recorder already inactive (e.g. very short recording)
    if (!recorder || recorder.state === "inactive") {
      if (allRawBlobsRef.current.length > 0) {
        const full = new Blob(allRawBlobsRef.current, { type: mimeTypeRef.current });
        setAudioBlob(full);
        setAudioUrl(URL.createObjectURL(full));

        if (chunkIndexRef.current === 0) {
          const segmentDuration = Math.max(1, Date.now() - segmentStartTimeRef.current);
          dispatchChunkBlob(full, chunkIndexRef.current++, segmentDuration);
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // No last chunk to dispatch, mark as queued immediately
      setIsLastChunkQueued(true);
      stopCompletePromiseRef.current = Promise.resolve();
      return Promise.resolve();
    }

    // Create a new Promise that will resolve when onstop finishes
    const stopPromise = new Promise<void>((resolve) => {
      stopCompleteResolveRef.current = resolve;
    });
    stopCompletePromiseRef.current = stopPromise;

    // Override onstop to handle the final chunk and resolve the promise
    const lastBlobs: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        lastBlobs.push(e.data);
        allRawBlobsRef.current.push(e.data);
      }
    };
    recorder.onstop = () => {
      if (lastBlobs.length > 0) {
        const segmentDuration = Date.now() - segmentStartTimeRef.current;
        dispatchChunkBlob(
          new Blob(lastBlobs, { type: mimeTypeRef.current }),
          chunkIndexRef.current++,
          segmentDuration
        );
      }
      const full = new Blob(allRawBlobsRef.current, { type: mimeTypeRef.current });
      setAudioBlob(full);
      setAudioUrl(URL.createObjectURL(full));
      streamRef.current?.getTracks().forEach((t) => t.stop());

      // Fix 1+4: Last chunk has been dispatched to the queue
      setIsLastChunkQueued(true);
      stopCompleteResolveRef.current?.();
    };
    if (typeof recorder.requestData === "function" && recorder.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        // ignore browsers that throw when forcing requestData near stop
      }
    }
    recorder.stop();

    return stopPromise;
  }, [dispatchChunkBlob]);

  // ─── pause() / resume() ──────────────────────────────────────────────────────
  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setStateSync("paused");
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setStateSync("recording");
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      chunkTimerRef.current = setInterval(flushSegment, chunkDurationMs);
    }
  }, [chunkDurationMs, flushSegment]);

  // ─── assembleTranscript() — Fix 2+3: waits for stop + in-flight chunks ──────
  const assembleTranscript = useCallback(async (): Promise<string> => {
    setIsAssembling(true);
    setFinalizationWarning(null);

    // Fix 2: Wait for stop()'s onstop to finish dispatching the last chunk
    if (stateRef.current === "stopped") {
      await stopCompletePromiseRef.current;
    }

    // Fix 3: Now capture and await the transcription queue (includes the last chunk)
    await transcriptionQueueRef.current;

    // Aguarda fila estabilizar. Em caso extremo de timeout, marca in-flight como erro explícito.
    const startWait = Date.now();
    while (hasInFlightChunks(chunksRef.current)) {
      if (Date.now() - startWait > ASSEMBLE_MAX_WAIT_MS) {
        const timeoutReason =
          "Tempo limite excedido ao aguardar segmentos pendentes. Revise os segmentos com erro.";
        markInFlightChunksAsError(timeoutReason);
        setFinalizationWarning(timeoutReason);
        break;
      }
      await transcriptionQueueRef.current;
      await new Promise((resolve) => setTimeout(resolve, ASSEMBLE_POLL_INTERVAL_MS));
    }

    const errorCount = countErroredChunks(chunksRef.current);
    if (errorCount > 0) {
      const warning = `Erro em ${errorCount} segmento(s). Revise antes de continuar.`;
      setFinalizationWarning(warning);
      console.warn(
        `[assembleTranscript] ${warning}`,
        chunksRef.current
          .filter((chunk) => chunk.status === "error")
          .map((chunk) => `Seg.${chunk.index + 1}: ${chunk.error ?? "Erro desconhecido"}`)
      );
    }

    const text = buildTranscriptFromChunks(chunksRef.current);
    setFinalTranscript(text);
    setIsAssembling(false);
    return text;
  }, [markInFlightChunksAsError]);

  // ─── reset() ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStateSync("idle");
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    chunksRef.current = [];
    setChunks([]);
    setFinalTranscript(null);
    setIsAssembling(false);
    setFinalizationWarning(null);
    setIsLastChunkQueued(true); // Fix: reset to true (idle state has no pending stop)
    allRawBlobsRef.current = [];
    chunkIndexRef.current = 0;
    sessionIdRef.current = "";
    stopCompletePromiseRef.current = Promise.resolve(); // Fix: reset stop promise
    stopCompleteResolveRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
  }, []);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const completedChunks = chunks.filter((c) => c.status === "done").length;
  const totalChunks = chunks.length;
  const hasErrors = chunks.some((c) => c.status === "error");
  const allChunksDone =
    totalChunks > 0 && chunks.every((c) => c.status === "done" || c.status === "error");
  const transcribedSoFar = chunks
    .filter((c) => c.status === "done")
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    state,
    duration,
    audioBlob,
    audioUrl,
    chunks,
    finalTranscript,
    isAssembling,
    finalizationWarning,
    isLastChunkQueued, // Fix 4: exposed for UI to disable button
    recordingSessionId: sessionIdRef.current,
    start,
    stop,
    pause,
    resume,
    reset,
    assembleTranscript,
    isRecording: state === "recording",
    isPaused: state === "paused",
    isStopped: state === "stopped",
    completedChunks,
    totalChunks,
    hasErrors,
    allChunksDone,
    transcribedSoFar,
  };
}
