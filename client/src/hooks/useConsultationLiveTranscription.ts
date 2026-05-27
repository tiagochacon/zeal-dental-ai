import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collapsePrefixDuplicateSegments,
  mergeFinalSegment,
} from "@shared/liveTranscriptSegments";

export type LiveSpeakerRole = "DENTIST" | "PATIENT" | "UNKNOWN";

export type LiveTranscriptSegment = {
  turnId: string;
  text: string;
  isFinal: true;
  speakerLabel: string | null;
  speakerRole: LiveSpeakerRole;
  startMs: number | null;
  endMs: number | null;
  confidence: number | null;
  provider: "assemblyai" | "deepgram" | "openai";
  model: string;
  createdAt: string;
};

type LiveSocketEvent = {
  type: "partial" | "final" | "error" | "session_started" | "session_closed" | "integrity";
  sessionId: string;
  consultationId: number;
  turnId?: string;
  text?: string;
  isFinal?: boolean;
  speakerLabel?: string | null;
  speakerRole?: LiveSpeakerRole;
  startMs?: number | null;
  endMs?: number | null;
  confidence?: number | null;
  provider?: "assemblyai" | "deepgram" | "openai";
  model?: string;
  warnings?: string[];
  error?: string;
  integrity?: {
    audioPacketsSent: number;
    finalTurnsReceived: number;
    providerClosed: boolean;
    startedAt: string;
    endedAt: string;
  };
  createdAt: string;
};

export type LiveTranscriptionResult = {
  transcript: string;
  segments: LiveTranscriptSegment[];
  rawAudioBlob: Blob;
  warnings: string[];
  fallbackUsed: boolean;
  provider: "assemblyai" | "deepgram" | "openai" | null;
  model: string | null;
  integrity: LiveSocketEvent["integrity"] | null;
  audioDurationMs: number;
};

type RecorderState =
  | "idle"
  | "connecting"
  | "recording"
  | "paused"
  | "stopping"
  | "stopped"
  | "error";

type RecentPacket = {
  sentAt: number;
  payload: ArrayBuffer;
};

function pcmFloat32ToInt16(channelData: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(channelData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function getSocketUrl(consultationId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/consultations/${consultationId}/stream-transcription`;
}

function pushUniqueWarning(current: string[], warning: string): string[] {
  if (!warning.trim()) return current;
  if (current.includes(warning)) return current;
  return [...current, warning];
}

export function useConsultationLiveTranscription(consultationId: number) {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [partialText, setPartialText] = useState("");
  const [segments, setSegments] = useState<LiveTranscriptSegment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [integrity, setIntegrity] = useState<LiveSocketEvent["integrity"] | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected" | "reconnecting"
  >("disconnected");

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const rawChunksRef = useRef<Blob[]>([]);
  const rawMimeTypeRef = useRef("audio/webm");
  const socketRef = useRef<WebSocket | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const recentPacketsRef = useRef<RecentPacket[]>([]);
  const shouldStopRef = useRef(false);
  const captureActiveRef = useRef(false);
  const stateRef = useRef<RecorderState>("idle");
  const fallbackNeededRef = useRef(false);
  const sessionClosedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const providerRef = useRef<"assemblyai" | "deepgram" | "openai" | null>(null);
  const modelRef = useRef<string | null>(null);
  const startTsRef = useRef<number | null>(null);

  const maxRecentMs = 5000;
  const maxReconnectAttempts = 2;

  const transcript = useMemo(
    () =>
      collapsePrefixDuplicateSegments(segments)
        .map((segment) => segment.text)
        .join("\n")
        .trim(),
    [segments]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTimer = useCallback(() => {
    if (durationTimerRef.current !== null) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const clearAudioGraph = useCallback(async () => {
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      gainRef.current?.disconnect();
      if (contextRef.current) {
        await contextRef.current.close();
      }
    } catch {
      // no-op cleanup
    } finally {
      processorRef.current = null;
      sourceRef.current = null;
      gainRef.current = null;
      contextRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socketRef.current = null;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "close" }));
      socket.close();
      return;
    }
    if (socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const flushRecentAudioPackets = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    const recentPackets = recentPacketsRef.current.filter(
      (packet) => now - packet.sentAt <= maxRecentMs
    );
    for (const packet of recentPackets) {
      socket.send(packet.payload);
    }
  }, []);

  const handleSocketEvent = useCallback((event: LiveSocketEvent) => {
    const eventLatency = Date.now() - new Date(event.createdAt).getTime();
    if (Number.isFinite(eventLatency) && eventLatency >= 0) {
      setLatencyMs(eventLatency);
    }

    if (event.provider) providerRef.current = event.provider;
    if (event.model) modelRef.current = event.model;

    if (event.type === "session_started") {
      sessionStartedRef.current = true;
      flushRecentAudioPackets();
      setConnectionState("connected");
      if (event.warnings?.length) {
        setWarnings((prev) =>
          event.warnings!.reduce((acc, warning) => pushUniqueWarning(acc, warning), prev)
        );
      }
      return;
    }

    if (event.type === "partial") {
      setPartialText(event.text || "");
      return;
    }

    if (event.type === "final") {
      const text = (event.text || "").trim();
      if (!text) return;
      setPartialText("");
      const segment: LiveTranscriptSegment = {
        turnId: event.turnId || `turn_${Date.now()}`,
        text,
        isFinal: true,
        speakerLabel: event.speakerLabel ?? null,
        speakerRole: event.speakerRole || "UNKNOWN",
        startMs: event.startMs ?? null,
        endMs: event.endMs ?? null,
        confidence: event.confidence ?? null,
        provider: event.provider || "assemblyai",
        model: event.model || "unknown",
        createdAt: event.createdAt,
      };
      setSegments((prev) => mergeFinalSegment(prev, segment));
      return;
    }

    if (event.type === "integrity") {
      setIntegrity(event.integrity || null);
      return;
    }

    if (event.type === "session_closed") {
      sessionClosedRef.current = true;
      return;
    }

    if (event.type === "error") {
      fallbackNeededRef.current = true;
      setWarnings((prev) =>
        pushUniqueWarning(prev, event.error || "Falha de streaming durante a consulta.")
      );
      return;
    }
  }, [flushRecentAudioPackets]);

  const connectSocket = useCallback(async (): Promise<void> => {
    setConnectionState((prev) => (prev === "connected" ? prev : "connecting"));
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(getSocketUrl(consultationId));
      socketRef.current = ws;
      ws.binaryType = "arraybuffer";
      let startAcked = false;
      let settled = false;

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start" }));
      };

      ws.onmessage = (message) => {
        try {
          const rawText =
            typeof message.data === "string"
              ? message.data
              : new TextDecoder().decode(message.data as ArrayBuffer);
          const event = JSON.parse(rawText) as LiveSocketEvent;
          if (event.type === "session_started") {
            startAcked = true;
            settleResolve();
          }
          if (event.type === "error" && !startAcked) {
            settleReject(
              new Error(event.error || "Falha ao iniciar sessão de streaming.")
            );
          }
          handleSocketEvent(event);
        } catch {
          setWarnings((prev) =>
            pushUniqueWarning(prev, "Evento inválido recebido do streaming.")
          );
        }
      };

      ws.onerror = () => {
        settleReject(
          new Error("Não foi possível conectar ao streaming de consulta.")
        );
      };

      ws.onclose = () => {
        if (!startAcked) {
          settleReject(
            new Error(
              "Sessão de streaming foi encerrada antes de confirmar inicialização."
            )
          );
        }
        const currentState = stateRef.current;
        const isActive =
          currentState === "recording" ||
          currentState === "paused" ||
          currentState === "stopping";
        if (!shouldStopRef.current && isActive) {
          setConnectionState("reconnecting");
          setReconnectCount((prev) => prev + 1);
        } else {
          setConnectionState("disconnected");
        }
      };
    });
  }, [consultationId, handleSocketEvent]);

  const attemptReconnect = useCallback(async () => {
    if (reconnectCount > maxReconnectAttempts) {
      fallbackNeededRef.current = true;
      setWarnings((prev) =>
        pushUniqueWarning(
          prev,
          "Conexão de streaming não recuperada. O sistema usará fallback batch no encerramento."
        )
      );
      return;
    }
    sessionStartedRef.current = false;
    try {
      await connectSocket();
    } catch {
      window.setTimeout(() => {
        setReconnectCount((prev) => prev + 1);
      }, 1200);
    }
  }, [connectSocket, reconnectCount]);

  const attachAudioCapture = useCallback(async () => {
    if (!streamRef.current) return;
    const sampleRate = Number(import.meta.env.VITE_CONSULTATION_STREAMING_SAMPLE_RATE || "16000");
    const audioContext = new AudioContext({ sampleRate });
    const source = audioContext.createMediaStreamSource(streamRef.current);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const gain = audioContext.createGain();
    gain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (!captureActiveRef.current || !sessionStartedRef.current) return;
      const channelData = event.inputBuffer.getChannelData(0);
      const pcmBuffer = pcmFloat32ToInt16(channelData);
      const packet: RecentPacket = { sentAt: Date.now(), payload: pcmBuffer };
      recentPacketsRef.current = [...recentPacketsRef.current, packet].filter(
        (item) => Date.now() - item.sentAt <= maxRecentMs
      );
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(pcmBuffer);
      }
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);

    contextRef.current = audioContext;
    sourceRef.current = source;
    processorRef.current = processor;
    gainRef.current = gain;
  }, []);

  const startRawRecorder = useCallback(() => {
    if (!streamRef.current) return;
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ];
    const mimeType =
      preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    rawMimeTypeRef.current = recorder.mimeType || "audio/webm";
    rawChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) rawChunksRef.current.push(event.data);
    };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
  }, []);

  const start = useCallback(async () => {
    try {
      shouldStopRef.current = false;
      fallbackNeededRef.current = false;
      sessionClosedRef.current = false;
      sessionStartedRef.current = false;
      providerRef.current = null;
      modelRef.current = null;
      setWarnings([]);
      setSegments([]);
      setPartialText("");
      setReconnectCount(0);
      setDurationSec(0);
      setIntegrity(null);
      setLatencyMs(null);
      setState("connecting");
      setConnectionState("connecting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      await connectSocket();
      startRawRecorder();
      setState("recording");
      captureActiveRef.current = true;
      startTsRef.current = Date.now();
      await attachAudioCapture();
      clearTimer();
      durationTimerRef.current = window.setInterval(() => {
        if (!startTsRef.current) return;
        const elapsed = Math.max(0, Math.floor((Date.now() - startTsRef.current) / 1000));
        setDurationSec(elapsed);
      }, 1000);
    } catch (error) {
      captureActiveRef.current = false;
      sessionStartedRef.current = false;
      closeSocket();
      await clearAudioGraph();
      stopTracks();
      clearTimer();
      setState("error");
      setConnectionState("disconnected");
      throw error;
    }
  }, [attachAudioCapture, clearAudioGraph, clearTimer, closeSocket, connectSocket, startRawRecorder, stopTracks]);

  const pause = useCallback(async () => {
    if (state !== "recording") return;
    try {
      await contextRef.current?.suspend();
      mediaRecorderRef.current?.pause();
      captureActiveRef.current = false;
      setState("paused");
    } catch {
      setWarnings((prev) => pushUniqueWarning(prev, "Não foi possível pausar a gravação."));
    }
  }, [state]);

  const resume = useCallback(async () => {
    if (state !== "paused") return;
    try {
      await contextRef.current?.resume();
      mediaRecorderRef.current?.resume();
      captureActiveRef.current = true;
      setState("recording");
    } catch {
      setWarnings((prev) => pushUniqueWarning(prev, "Não foi possível retomar a gravação."));
    }
  }, [state]);

  const stop = useCallback(async () => {
    if (!["recording", "paused", "connecting"].includes(state)) return;
    shouldStopRef.current = true;
    captureActiveRef.current = false;
    setState("stopping");
    clearTimer();

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "client_stop_requested" }));
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    await clearAudioGraph();
    stopTracks();
    setState("stopped");
  }, [clearAudioGraph, clearTimer, state, stopTracks]);

  const reset = useCallback(async () => {
    shouldStopRef.current = true;
    captureActiveRef.current = false;
    sessionStartedRef.current = false;
    clearTimer();
    closeSocket();
    await clearAudioGraph();
    stopTracks();
    mediaRecorderRef.current = null;
    rawChunksRef.current = [];
    recentPacketsRef.current = [];
    setState("idle");
    setDurationSec(0);
    setPartialText("");
    setSegments([]);
    setWarnings([]);
    setIntegrity(null);
    setLatencyMs(null);
    setReconnectCount(0);
    setConnectionState("disconnected");
  }, [clearAudioGraph, clearTimer, closeSocket, stopTracks]);

  useEffect(() => {
    if (connectionState !== "reconnecting") return;
    if (!["recording", "paused"].includes(state)) return;
    const timeoutId = window.setTimeout(() => {
      attemptReconnect();
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [attemptReconnect, connectionState, state, reconnectCount]);

  const finalize = useCallback(async (): Promise<LiveTranscriptionResult> => {
    if (state === "recording" || state === "paused" || state === "connecting") {
      await stop();
    }

    if (connectionState === "reconnecting") {
      await attemptReconnect();
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "client_final_flush" }));
    }

    const startedWaitingAt = Date.now();
    while (!sessionClosedRef.current && Date.now() - startedWaitingAt < 6000) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }

    if (!sessionClosedRef.current) {
      fallbackNeededRef.current = true;
      setWarnings((prev) =>
        pushUniqueWarning(
          prev,
          "Sessão não confirmou fechamento completo. Fallback batch será usado."
        )
      );
    }

    closeSocket();

    const rawAudioBlob = new Blob(rawChunksRef.current, { type: rawMimeTypeRef.current });
    const audioDurationMs = durationSec * 1000;
    const sanitizedSegments = collapsePrefixDuplicateSegments(segments);
    const transcriptText = sanitizedSegments.map((segment) => segment.text).join("\n").trim();

    let computedCoverageRatio: number | null = null;
    if (sanitizedSegments.length > 0 && audioDurationMs > 0) {
      const maxEnd = sanitizedSegments
        .map((segment) => segment.endMs)
        .filter((value): value is number => typeof value === "number")
        .reduce((max, value) => Math.max(max, value), 0);
      if (maxEnd > 0) computedCoverageRatio = maxEnd / audioDurationMs;
      if (computedCoverageRatio !== null && computedCoverageRatio < 0.75) {
        const coveragePct = Math.round((computedCoverageRatio ?? 0) * 100);
        fallbackNeededRef.current = true;
        setWarnings((prev) =>
          pushUniqueWarning(
            prev,
            `Cobertura da transcrição baixa (${coveragePct}%).`
          )
        );
      }
    }

    const finalWarnings =
      computedCoverageRatio !== null && computedCoverageRatio < 0.75
        ? pushUniqueWarning(
            warnings,
            `Cobertura da transcrição baixa (${Math.round((computedCoverageRatio || 0) * 100)}%).`
          )
        : warnings;

    return {
      transcript: transcriptText,
      segments: sanitizedSegments,
      rawAudioBlob,
      warnings: finalWarnings,
      fallbackUsed: fallbackNeededRef.current || !transcriptText,
      provider: providerRef.current,
      model: modelRef.current,
      integrity,
      audioDurationMs,
    };
  }, [
    attemptReconnect,
    closeSocket,
    connectionState,
    durationSec,
    integrity,
    segments,
    state,
    stop,
    warnings,
  ]);

  return {
    state,
    durationSec,
    partialText,
    segments,
    transcript,
    warnings,
    integrity,
    latencyMs,
    reconnectCount,
    connectionState,
    isRecording: state === "recording",
    isPaused: state === "paused",
    isStopped: state === "stopped",
    start,
    pause,
    resume,
    stop,
    reset,
    finalize,
  };
}
