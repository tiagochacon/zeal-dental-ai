import { useState, useCallback } from "react";
import { Mic, MicOff, Pause, Play, Square, RotateCcw, CheckCircle2, Loader2, AlertCircle, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgressiveAudioRecorder } from "@/hooks/useProgressiveAudioRecorder";
import { formatDuration } from "@/lib/utils";
import type { ChunkTranscription } from "@/hooks/useProgressiveAudioRecorder";

interface AudioRecorderProps {
  onTranscriptReady: (transcript: string) => void;
  onError?: (msg: string) => void;
}

export function AudioRecorder({ onTranscriptReady, onError }: AudioRecorderProps) {
  const [micError, setMicError] = useState<string | null>(null);

  const recorder = useProgressiveAudioRecorder({
    chunkDurationMs: 60_000, // flush every 60s
    onChunkTranscribed: (c) => console.log(`✅ Chunk ${c.index} transcrito`),
    onChunkError: (c) => console.warn(`⚠️ Chunk ${c.index} falhou:`, c.error),
  });

  const handleStart = async () => {
    setMicError(null);
    try {
      await recorder.start();
    } catch {
      const msg = "Não foi possível acessar o microfone. Verifique as permissões.";
      setMicError(msg);
      onError?.(msg);
    }
  };

  const handleStop = () => {
    recorder.stop();
  };

  const handleFinish = useCallback(async () => {
    const transcript = await recorder.assembleTranscript();
    if (!transcript) {
      onError?.("Nenhuma fala detectada no áudio.");
      return;
    }
    onTranscriptReady(transcript);
  }, [recorder, onTranscriptReady, onError]);

  return (
    <div className="flex flex-col gap-4">
      {/* Main recording card */}
      <div
        className={cn(
          "rounded-2xl border p-6 flex flex-col items-center gap-4 transition-all duration-300",
          recorder.isRecording && "border-red-400 bg-red-50 dark:bg-red-950/20",
          recorder.isPaused && "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
          recorder.isStopped && "border-green-400 bg-green-50 dark:bg-green-950/20",
          !recorder.isRecording && !recorder.isPaused && !recorder.isStopped && "border-border bg-card"
        )}
      >
        {/* Waveform / icon */}
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
            recorder.isRecording ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"
          )}
        >
          {recorder.isRecording ? (
            <Waves className="w-7 h-7 text-red-500 animate-pulse" />
          ) : recorder.isPaused ? (
            <Pause className="w-7 h-7 text-yellow-500" />
          ) : recorder.isStopped ? (
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          ) : (
            <Mic className="w-7 h-7 text-muted-foreground" />
          )}
        </div>

        {/* Timer */}
        <div className="text-center">
          <p className="text-3xl font-mono font-bold tabular-nums">
            {formatDuration(recorder.duration)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {recorder.isRecording && "Gravando..."}
            {recorder.isPaused && "Pausado"}
            {recorder.isStopped && "Gravação concluída"}
            {recorder.state === "idle" && "Pronto para gravar"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {recorder.state === "idle" && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Iniciar gravação
            </button>
          )}

          {recorder.isRecording && (
            <>
              <button
                onClick={recorder.pause}
                className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-yellow-600 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
                Parar
              </button>
            </>
          )}

          {recorder.isPaused && (
            <>
              <button
                onClick={recorder.resume}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Play className="w-4 h-4" />
                Retomar
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
                Parar
              </button>
            </>
          )}

          {recorder.isStopped && (
            <>
              <button
                onClick={recorder.reset}
                className="flex items-center gap-2 border border-input bg-background px-4 py-2 rounded-full text-sm font-medium hover:bg-accent transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Regravar
              </button>
              <button
                onClick={handleFinish}
                disabled={recorder.isAssembling || recorder.totalChunks === 0}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {recorder.isAssembling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {recorder.isAssembling ? "Finalizando..." : "Usar transcrição"}
              </button>
            </>
          )}
        </div>

        {micError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {micError}
          </p>
        )}
      </div>

      {/* Chunk progress — only show if we have at least one chunk */}
      {recorder.totalChunks > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Transcrição em progresso
            </p>
            <p className="text-xs text-muted-foreground">
              {recorder.completedChunks}/{recorder.totalChunks} segmentos
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{
                width: `${recorder.totalChunks > 0 ? (recorder.completedChunks / recorder.totalChunks) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Per-chunk pills */}
          <div className="flex flex-wrap gap-2">
            {recorder.chunks
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((chunk) => (
                <ChunkPill key={chunk.index} chunk={chunk} />
              ))}
          </div>

          {/* Live partial transcript */}
          {recorder.transcribedSoFar && (
            <div className="mt-2 rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Transcrição parcial</p>
              <p className="text-sm leading-relaxed line-clamp-4">{recorder.transcribedSoFar}</p>
            </div>
          )}

          {/* Error summary */}
          {recorder.hasErrors && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Alguns segmentos falharam. A transcrição final pode estar incompleta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chunk status pill ────────────────────────────────────────────────────────
function ChunkPill({ chunk }: { chunk: ChunkTranscription }) {
  return (
    <div
      title={chunk.error ?? chunk.text}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        chunk.status === "done" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        chunk.status === "transcribing" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        chunk.status === "pending" && "bg-muted text-muted-foreground",
        chunk.status === "error" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {chunk.status === "done" && <CheckCircle2 className="w-3 h-3" />}
      {chunk.status === "transcribing" && <Loader2 className="w-3 h-3 animate-spin" />}
      {chunk.status === "error" && <AlertCircle className="w-3 h-3" />}
      Seg. {chunk.index + 1}
    </div>
  );
}
