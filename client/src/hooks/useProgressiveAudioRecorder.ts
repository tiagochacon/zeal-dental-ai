import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface ChunkTranscription {
  index: number;
  status: "pending" | "transcribing" | "done" | "error";
  text: string;
  error?: string;
}

export interface ProgressiveRecorderOptions {
  /** Tamanho de cada chunk em ms. Padrão: 30000 (30s) */
  chunkDurationMs?: number;
  /** Chamado quando um chunk termina de ser transcrito */
  onChunkTranscribed?: (chunk: ChunkTranscription) => void;
  /** Chamado quando um erro ocorre em um chunk — não cancela os demais */
  onChunkError?: (chunk: ChunkTranscription) => void;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcribeChunkRequest(
  blob: Blob,
  mimeType: string,
  index: number
): Promise<string> {
  const base64 = await blobToBase64(blob);
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";

  const res = await fetch("/api/transcribe-chunk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64: base64,
      fileName: `chunk_${index}.${ext}`,
      mimeType,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error ?? "Falha na transcrição");
  }

  const data = await res.json();
  return (data as any).transcript as string;
}

export function useProgressiveAudioRecorder(options: ProgressiveRecorderOptions = {}) {
  const { chunkDurationMs = 30_000, onChunkTranscribed, onChunkError } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkTranscription[]>([]);
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const allRawBlobsRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Serial queue: transcriptions go in order, don't block each other
  const transcriptionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef<RecordingState>("idle");

  // Keep stateRef in sync for use inside callbacks
  const setStateSync = (s: RecordingState) => {
    stateRef.current = s;
    setState(s);
  };

  // ─── Update a chunk in state ─────────────────────────────────────────────────
  const updateChunk = (index: number, update: Partial<ChunkTranscription>) => {
    setChunks((prev) => prev.map((c) => (c.index === index ? { ...c, ...update } : c)));
  };

  // ─── Dispatch blob → queue transcription ────────────────────────────────────
  const dispatchChunkBlob = useCallback(
    (blob: Blob, index: number) => {
      setChunks((prev) => [...prev, { index, status: "pending", text: "" }]);

      transcriptionQueueRef.current = transcriptionQueueRef.current.then(async () => {
        updateChunk(index, { status: "transcribing" });
        try {
          const text = await transcribeChunkRequest(blob, mimeTypeRef.current, index);
          updateChunk(index, { status: "done", text });
          onChunkTranscribed?.({ index, status: "done", text });
        } catch (err: any) {
          const error = err?.message ?? "Erro desconhecido";
          updateChunk(index, { status: "error", text: "", error });
          onChunkError?.({ index, status: "error", text: "", error });
        }
      });
    },
    [onChunkTranscribed, onChunkError]
  );

  // ─── Start a fresh MediaRecorder segment ────────────────────────────────────
  const startSegment = useCallback(
    (stream: MediaStream) => {
      const segmentBlobs: Blob[] = [];

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
        dispatchChunkBlob(blob, chunkIndexRef.current++);

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

  // ─── Flush current segment early (called by interval) ───────────────────────
  const flushSegment = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    // onstop will restart automatically
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
      transcriptionQueueRef.current = Promise.resolve();

      setChunks([]);
      setFinalTranscript(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);

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

  // ─── stop() ─────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

    setStateSync("stopped");

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      // Build full blob from what we have
      if (allRawBlobsRef.current.length > 0) {
        const full = new Blob(allRawBlobsRef.current, { type: mimeTypeRef.current });
        setAudioBlob(full);
        setAudioUrl(URL.createObjectURL(full));
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }

    // Capture last segment
    const lastBlobs: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        lastBlobs.push(e.data);
        allRawBlobsRef.current.push(e.data);
      }
    };
    recorder.onstop = () => {
      if (lastBlobs.length > 0) {
        dispatchChunkBlob(new Blob(lastBlobs, { type: mimeTypeRef.current }), chunkIndexRef.current++);
      }
      const full = new Blob(allRawBlobsRef.current, { type: mimeTypeRef.current });
      setAudioBlob(full);
      setAudioUrl(URL.createObjectURL(full));
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    recorder.stop();
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

  // ─── assembleTranscript() — waits for all chunks, returns joined text ────────
  const assembleTranscript = useCallback(async (): Promise<string> => {
    setIsAssembling(true);
    await transcriptionQueueRef.current;

    return new Promise((resolve) => {
      setChunks((currentChunks) => {
        const sorted = [...currentChunks].sort((a, b) => a.index - b.index);
        const text = sorted
          .filter((c) => c.status === "done")
          .map((c) => c.text.trim())
          .filter(Boolean)
          .join(" ");
        setFinalTranscript(text);
        setIsAssembling(false);
        resolve(text);
        return currentChunks;
      });
    });
  }, []);

  // ─── reset() ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStateSync("idle");
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setChunks([]);
    setFinalTranscript(null);
    setIsAssembling(false);
    allRawBlobsRef.current = [];
    chunkIndexRef.current = 0;
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
    .join(" ");

  return {
    state,
    duration,
    audioBlob,
    audioUrl,
    chunks,
    finalTranscript,
    isAssembling,
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
