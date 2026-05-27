import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Signal,
  Square,
  Waves,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import {
  type LiveTranscriptionResult,
  useConsultationLiveTranscription,
} from "@/hooks/useConsultationLiveTranscription";

type LiveConsultationRecorderProps = {
  consultationId: number;
  onComplete: (result: LiveTranscriptionResult) => Promise<void> | void;
  onError?: (message: string) => void;
};

function connectionLabel(
  state: "disconnected" | "connecting" | "connected" | "reconnecting"
): string {
  if (state === "connected") return "Conectado";
  if (state === "connecting") return "Conectando";
  if (state === "reconnecting") return "Reconectando";
  return "Desconectado";
}

export function LiveConsultationRecorder({
  consultationId,
  onComplete,
  onError,
}: LiveConsultationRecorderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recorder = useConsultationLiveTranscription(consultationId);
  const captionScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = captionScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [recorder.partialText, recorder.segments.length]);

  const handleStart = async () => {
    try {
      await recorder.start();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível iniciar o streaming da consulta.";
      onError?.(message);
    }
  };

  const handleStop = async () => {
    try {
      await recorder.stop();
    } catch {
      onError?.("Não foi possível parar a gravação.");
    }
  };

  const handleFinish = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await recorder.finalize();
      if (result.warnings.length > 0) {
        onError?.(result.warnings[0]);
      }
      await onComplete(result);
    } catch {
      onError?.("Falha ao finalizar transcrição ao vivo.");
    } finally {
      setIsSubmitting(false);
    }
  }, [onComplete, onError, recorder]);

  const statusClass = cn(
    "rounded-2xl border p-6 flex flex-col gap-4 transition-all",
    recorder.isRecording && "border-red-400/70 bg-red-950/15",
    recorder.isPaused && "border-yellow-400/70 bg-yellow-950/15",
    recorder.isStopped && "border-green-400/70 bg-green-950/15",
    !recorder.isRecording &&
      !recorder.isPaused &&
      !recorder.isStopped &&
      "border-border bg-card"
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={statusClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">
              Streaming em tempo real ({connectionLabel(recorder.connectionState)})
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Latência: {recorder.latencyMs ? `${recorder.latencyMs}ms` : "--"}
          </div>
        </div>

        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            recorder.isRecording
              ? "bg-red-500/20"
              : recorder.isPaused
                ? "bg-yellow-500/20"
                : recorder.isStopped
                  ? "bg-green-500/20"
                  : "bg-muted"
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

        <div className="text-center">
          <p className="text-3xl font-mono font-bold tabular-nums">
            {formatDuration(recorder.durationSec)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {recorder.state === "connecting" && "Conectando ao streaming..."}
            {recorder.isRecording && "Gravando e transcrevendo ao vivo"}
            {recorder.isPaused && "Pausado"}
            {recorder.isStopped && "Gravação concluída"}
            {recorder.state === "error" && "Erro ao iniciar streaming"}
            {recorder.state === "idle" && "Pronto para iniciar"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {recorder.state === "error" && (
            <button
              onClick={recorder.reset}
              className="flex items-center gap-2 border border-input bg-background px-4 py-2 rounded-full text-sm font-medium hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </button>
          )}

          {recorder.state === "idle" && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Iniciar live
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
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Usar transcrição
              </button>
            </>
          )}
        </div>

        {recorder.connectionState === "connecting" && recorder.state === "connecting" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Conectando ao AssemblyAI...
          </p>
        )}

        {recorder.connectionState === "reconnecting" && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Reconectando streaming ({recorder.reconnectCount})...
          </p>
        )}

        {recorder.state === "error" && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Falha ao conectar. Tente novamente ou use o modo progressivo.
          </p>
        )}
      </div>

      {(recorder.partialText ||
        recorder.segments.length > 0 ||
        recorder.isRecording ||
        recorder.isPaused ||
        recorder.state === "connecting") && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Legenda ao vivo</p>

          <div
            ref={captionScrollRef}
            className="max-h-48 overflow-auto space-y-2 text-sm scroll-smooth"
          >
            {recorder.segments.length > 0 && (
              <div className="space-y-2">
                {recorder.segments.map((segment) => (
                  <p key={segment.turnId} className="leading-relaxed">
                    {segment.speakerLabel ? `[${segment.speakerLabel}] ` : ""}
                    {segment.text}
                  </p>
                ))}
              </div>
            )}

            {recorder.partialText && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Parcial (mutável)
                </p>
                <p className="text-sm leading-relaxed">{recorder.partialText}</p>
              </div>
            )}

            {!recorder.partialText && recorder.segments.length === 0 && (
              <p className="text-xs text-muted-foreground">Aguardando fala...</p>
            )}
          </div>
        </div>
      )}

      {(recorder.warnings.length > 0 || recorder.integrity) && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          {recorder.warnings.slice(0, 3).map((warning) => (
            <p
              key={warning}
              className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {warning}
            </p>
          ))}
          {recorder.integrity && (
            <p className="text-xs text-muted-foreground">
              Integridade: {recorder.integrity.finalTurnsReceived} turnos finais,{" "}
              {recorder.integrity.audioPacketsSent} pacotes de áudio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
