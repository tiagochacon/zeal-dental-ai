import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mic, Square, Upload, Phone, FileAudio, Clock, AlertTriangle, CheckCircle, Volume2, MessageCircle, MessageSquare, FileArchive, Shield, Waves, RotateCcw } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const WAV_SIZE_WARNING_BYTES = 20 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30 * 60;
const MAX_DURATION_MINUTES = 30;
const ZIP_MAX_SIZE_MB = 100;
const ZIP_MAX_SIZE_BYTES = ZIP_MAX_SIZE_MB * 1024 * 1024;

export default function NewCall() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const preLeadId = searchParams.get("leadId");
  const preLeadName = searchParams.get("leadName");

  const [leadId, setLeadId] = useState(preLeadId ? parseInt(preLeadId) : 0);
  const [leadName, setLeadName] = useState(preLeadName || "");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [showWavWarning, setShowWavWarning] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Active tab state for dynamic copy
  const [activeTab, setActiveTab] = useState<"record" | "upload" | "whatsapp">("record");

  // WhatsApp tab state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipDragging, setZipDragging] = useState(false);
  const [whatsappUploading, setWhatsappUploading] = useState(false);
  const [whatsappProgress, setWhatsappProgress] = useState(0);
  const [whatsappStatus, setWhatsappStatus] = useState<string>("");
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const createCall = trpc.calls.create.useMutation({
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleAudioLoaded = useCallback(() => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setAudioDuration(Math.round(audioRef.current.duration));
    }
  }, []);

  const isMac = typeof navigator !== 'undefined' && (
    navigator.platform?.toUpperCase().includes('MAC') ||
    (navigator.userAgent?.includes('Mac') && !navigator.userAgent?.includes('Windows'))
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const MIME_TYPES = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        '',
      ];
      const mimeType = MIME_TYPES.find(type => type === '' || MediaRecorder.isTypeSupported(type)) ?? '';
      console.log('[Recording] mimeType selecionado:', mimeType || 'browser default');

      const recorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioDuration(null);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          const newTime = t + 1;
          if (newTime >= MAX_DURATION_SECONDS) {
            stopRecording();
            toast.info("Gravação encerrada automaticamente — limite de 30 minutos atingido.");
          }
          return newTime;
        });
      }, 1000);

      toast.success("Gravação iniciada!");
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const processAudioFile = (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Por favor, selecione um arquivo de áudio válido");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Arquivo muito grande (${formatFileSize(file.size)}). Tamanho máximo: ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    const isWav = file.type.includes('wav') || file.name.toLowerCase().endsWith('.wav');
    if (isWav && file.size > WAV_SIZE_WARNING_BYTES) {
      setShowWavWarning(true);
    } else {
      setShowWavWarning(false);
    }
    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    setAudioFileName(file.name);
    setRecordingTime(0);
    setAudioDuration(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAudioFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processAudioFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadAudioMultipart = async (callId: number, blob: Blob, durationSec: number): Promise<void> => {
    const formData = new FormData();
    const ext = blob.type.includes("webm") ? "webm" :
                blob.type.includes("mp3") || blob.type.includes("mpeg") ? "mp3" :
                blob.type.includes("mp4") || blob.type.includes("m4a") || blob.type.includes("aac") ? "m4a" :
                blob.type.includes("ogg") ? "ogg" :
                blob.type.includes("wav") ? "wav" : "webm";

    formData.append("file", blob, `recording.${ext}`);
    formData.append("callId", String(callId));
    formData.append("durationSeconds", String(durationSec));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload falhou (${xhr.status})`));
          } catch {
            reject(new Error(`Upload falhou (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Erro de rede durante o upload")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelado")));

      xhr.open("POST", "/api/calls/upload-audio");
      xhr.send(formData);
    });
  };

  const handleSubmit = async () => {
    if (!leadId || !leadName.trim()) {
      toast.error("Selecione um lead");
      return;
    }
    if (audioDuration && audioDuration > MAX_DURATION_SECONDS) {
      toast.error(`Duração máxima permitida: ${MAX_DURATION_MINUTES} minutos. Este áudio tem ${Math.ceil(audioDuration / 60)} minutos.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const call = await createCall.mutateAsync({
        leadId,
        leadName: leadName.trim(),
      });

      if (audioBlob && call.id) {
        const duration = audioDuration || recordingTime || 0;
        await uploadAudioMultipart(call.id, audioBlob, duration);
        toast.success(activeTab === "upload" ? "Interação registrada e áudio enviado com sucesso!" : "Ligação registrada e áudio enviado com sucesso!");
      } else {
        toast.success("Ligação registrada!");
      }

      setLocation(`/calls/${call.id}`);
    } catch (err: any) {
      toast.error(err.message || (activeTab === "upload" ? "Erro ao registrar interação" : "Erro ao registrar ligação"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // WhatsApp handlers
  const processZipFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Por favor, selecione um arquivo .zip exportado do WhatsApp");
      return;
    }
    if (file.size > ZIP_MAX_SIZE_BYTES) {
      toast.error(`Arquivo muito grande (${formatFileSize(file.size)}). Tamanho máximo: ${ZIP_MAX_SIZE_MB}MB`);
      return;
    }
    setZipFile(file);
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processZipFile(file);
  };

  const handleZipDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZipDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processZipFile(file);
  };

  const handleWhatsAppSubmit = async () => {
    if (!leadId || !leadName.trim()) {
      toast.error("Selecione um lead");
      return;
    }
    if (!zipFile) {
      toast.error("Selecione um arquivo .zip do WhatsApp");
      return;
    }

    setWhatsappUploading(true);
    setWhatsappProgress(0);
    setWhatsappStatus("Criando interação...");

    try {
      // Create call with whatsapp_export sourceType
      const call = await createCall.mutateAsync({
        leadId,
        leadName: leadName.trim(),
        sourceType: "whatsapp_export",
      });

      setWhatsappStatus("Enviando arquivo...");

      // Upload ZIP via multipart
      const formData = new FormData();
      formData.append("file", zipFile, zipFile.name);
      formData.append("callId", String(call.id));
      formData.append("leadName", leadName.trim());

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 50); // 0-50% for upload
            setWhatsappProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setWhatsappProgress(100);
            resolve();
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Processamento falhou (${xhr.status})`));
            } catch {
              reject(new Error(`Processamento falhou (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Erro de rede durante o envio")));
        xhr.addEventListener("abort", () => reject(new Error("Envio cancelado")));

        // After upload completes, server processes the zip (parsing + transcription)
        xhr.addEventListener("loadend", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setWhatsappStatus("Conversa processada com sucesso!");
          }
        });

        setWhatsappStatus("Enviando e processando conversa...");
        xhr.open("POST", "/api/calls/upload-whatsapp-export");
        xhr.send(formData);
      });

      toast.success("Conversa WhatsApp importada com sucesso!");
      setLocation(`/calls/${call.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar conversa WhatsApp");
    } finally {
      setWhatsappUploading(false);
      setWhatsappProgress(0);
      setWhatsappStatus("");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const leads = (leadsQuery.data || []).filter((l: any) => !l.isConverted);
  const remainingTime = MAX_DURATION_SECONDS - recordingTime;
  const isNearLimit = remainingTime <= 60;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-3xl font-bold text-foreground">Nova interação comercial</h1>
        <p className="text-sm text-muted-foreground">
          {activeTab === "record" && "Grave a ligação com o microfone ou use outra aba para enviar áudio ou importar WhatsApp."}
          {activeTab === "upload" && "Envie um arquivo de áudio da ligação ou use outra aba."}
          {activeTab === "whatsapp" && "Importe o .zip exportado pelo WhatsApp (com _chat.txt e mídias, se houver)."}
        </p>
      </div>

      {/* Select Lead */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Selecionar Lead</h2>
        {preLeadId ? (
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Phone className="h-5 w-5 text-blue-400" />
            <span className="font-medium text-foreground">{leadName}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {leadsQuery.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhum lead ativo. <Link href="/leads" className="text-blue-400">Cadastre um lead primeiro</Link>.
              </p>
            ) : (
              leads.map((lead: any) => (
                <div
                  key={lead.id}
                  onClick={() => { setLeadId(lead.id); setLeadName(lead.name); }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    leadId === lead.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border hover:border-blue-500/30"
                  }`}
                >
                  <p className="font-medium text-foreground text-sm">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "Sem contato"}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Perguntas guia para o CRC — visíveis após selecionar o lead */}
      {leadId > 0 && (
        <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Perguntas para entender melhor o lead
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Tente encaixar essas perguntas no ritmo da conversa. Elas ajudam a IA a identificar o perfil comportamental com mais precisão — não precisa parecer um questionário.
          </p>
          <ol className="space-y-3">
            {[
              "Me conta o que está te incomodando hoje e por que você decidiu procurar ajuda agora?",
              "O que você gostaria que mudasse depois dessa avaliação ou tratamento?",
              "Você já consultou outra clínica sobre isso? Se sim, o que faltou para você fechar lá?",
            ].map((pergunta, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed italic">"{pergunta}"</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Audio Recording / Upload / WhatsApp */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Registro da Interação</h2>

        <Tabs defaultValue="record" value={activeTab} onValueChange={(v) => setActiveTab(v as "record" | "upload" | "whatsapp")}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="record" className="flex-1">
              <Mic className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Gravar</span>
              <span className="sm:hidden">Gravar</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Enviar Áudio</span>
              <span className="sm:hidden">Áudio</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Gravar Agora */}
          <TabsContent value="record">
            <div className="flex flex-col gap-4">
              {/* Dica de viva-voz antes de gravar */}
              {!isRecording && !audioBlob && (
                <div className={`w-full rounded-lg p-4 ${isMac ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className={`h-4 w-4 ${isMac ? 'text-amber-400' : 'text-blue-400'}`} />
                    <p className={`text-sm font-medium ${isMac ? 'text-amber-300' : 'text-blue-300'}`}>{isMac ? 'Gravação no Mac — apenas microfone' : 'Dica para capturar a ligação completa'}</p>
                  </div>
                  {isMac ? (
                    <p className="text-xs text-amber-200/70">
                      No Mac, somente o microfone é gravado pelo navegador. Para capturar a ligação completa (sua voz + voz do cliente), use a aba <strong className="text-amber-300">Enviar Áudio</strong> após gravar com outro aplicativo (ex: Zoom, QuickTime). Em Windows com Chrome ou Edge a gravação completa está disponível.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-200/70">
                      Para que a IA consiga analisar tanto a sua fala quanto a do paciente, 
                      coloque a ligação no <strong className="text-blue-300">viva-voz</strong> ou 
                      use <strong className="text-blue-300">alto-falante</strong> do computador/celular 
                      durante a chamada. Assim o microfone captura os dois lados da conversa.
                    </p>
                  )}
                </div>
              )}

              {/* Recording card — estilo igual ao AudioRecorder da consulta */}
              <div className={`rounded-2xl border p-6 flex flex-col items-center gap-4 transition-all duration-300 ${
                isRecording
                  ? isNearLimit
                    ? "border-amber-400 bg-amber-950/20"
                    : "border-red-400 bg-red-950/20"
                  : audioBlob && !audioFileName
                    ? "border-green-400 bg-green-950/20"
                    : "border-border bg-card"
              }`}>
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  isRecording ? "bg-red-900/40" : audioBlob && !audioFileName ? "bg-green-900/40" : "bg-muted"
                }`}>
                  {isRecording ? (
                    <Waves className="w-7 h-7 text-red-500 animate-pulse" />
                  ) : audioBlob && !audioFileName ? (
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  ) : (
                    <Mic className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>

                {/* Timer */}
                <div className="text-center">
                  <p className="text-3xl font-mono font-bold tabular-nums">
                    {formatTime(recordingTime || audioDuration || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRecording && "Gravando..."}
                    {!isRecording && audioBlob && !audioFileName && "Gravação concluída"}
                    {!isRecording && !audioBlob && "Pronto para gravar"}
                  </p>
                </div>

                {/* Progress bar during recording */}
                {isRecording && (
                  <div className="w-64">
                    <Progress
                      value={(recordingTime / MAX_DURATION_SECONDS) * 100}
                      className={`h-1.5 ${isNearLimit ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">0:00</span>
                      <span className={`text-[10px] ${isNearLimit ? "text-amber-400 font-semibold" : "text-muted-foreground"}`}>
                        {isNearLimit && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                        Restam {formatTime(remainingTime)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{MAX_DURATION_MINUTES}:00</span>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3">
                  {!isRecording && !audioBlob && (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Iniciar gravação
                    </button>
                  )}

                  {isRecording && (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Parar
                    </button>
                  )}

                  {!isRecording && audioBlob && !audioFileName && (
                    <>
                      <button
                        onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); setAudioDuration(null); setShowWavWarning(false); }}
                        className="flex items-center gap-2 border border-input bg-background px-4 py-2 rounded-full text-sm font-medium hover:bg-accent transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Regravar
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!leadId || uploading || createCall.isPending}
                        className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {uploading || createCall.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {uploading ? "Enviando..." : createCall.isPending ? "Registrando..." : "Usar gravação"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Audio preview when recording is done */}
              {!isRecording && audioBlob && !audioFileName && (
                <div className="w-full space-y-2">
                  <audio
                    ref={audioRef}
                    controls
                    src={audioUrl || undefined}
                    className="w-full"
                    onLoadedMetadata={handleAudioLoaded}
                  />
                  <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <span>Duração: {formatTime(recordingTime || audioDuration || 0)}</span>
                    {audioBlob && <span>Tamanho: {formatFileSize(audioBlob.size)}</span>}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Enviar Arquivo */}
          <TabsContent value="upload">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {audioBlob && audioFileName ? (
              <div className="space-y-3">
                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl || undefined}
                  className="w-full"
                  onLoadedMetadata={handleAudioLoaded}
                />
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground truncate max-w-[200px]">{audioFileName}</span>
                    <span className="text-xs text-muted-foreground">
                      — {formatFileSize((audioBlob as File).size ?? 0)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setAudioBlob(null); setAudioUrl(null); setAudioFileName(null); setAudioDuration(null); setShowWavWarning(false); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Remover
                  </Button>
                </div>

                {showWavWarning && (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-300">Arquivo WAV muito grande para transcrição</p>
                        <p className="text-xs text-amber-200/70 mt-1">
                          Arquivos WAV do Mac geralmente ultrapassam o limite de 25MB do serviço de transcrição. Converta para MP3 ou M4A antes de enviar — qualquer conversor online gratuito resolve em segundos (ex: cloudconvert.com).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {audioDuration !== null && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    audioDuration > MAX_DURATION_SECONDS
                      ? "bg-red-500/10 text-red-400 border border-red-500/30"
                      : "bg-secondary/30 text-muted-foreground"
                  }`}>
                    <Clock className="h-3 w-3" />
                    <span>
                      Duração: {formatTime(audioDuration)}
                      {audioDuration > MAX_DURATION_SECONDS && (
                        <> — <AlertTriangle className="inline h-3 w-3 mx-0.5" /> Excede o limite de {MAX_DURATION_MINUTES} minutos</>
                      )}
                    </span>
                  </div>
                )}

                {audioBlob.size > 25 * 1024 * 1024 && (
                  <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      Arquivo grande ({formatFileSize(audioBlob.size)}). Para melhor performance na transcrição,
                      considere usar formato MP3 ou WebM com taxa de bits mais baixa.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Arraste um arquivo de áudio ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">Formatos: MP3, M4A, WAV, OGG, WebM — até {MAX_FILE_SIZE_MB}MB ({MAX_DURATION_MINUTES} min)</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: WhatsApp */}
          <TabsContent value="whatsapp">
            <div className="space-y-4">
              {/* Instrução */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-300">Importar conversa do WhatsApp</p>
                    <p className="text-xs text-green-200/70 mt-1 leading-relaxed">
                      Exporte a conversa do WhatsApp <strong className="text-green-300">com mídia</strong> e envie o arquivo .zip aqui. 
                      O ZEAL vai ler as mensagens, transcrever áudios e gerar análise DISC do lead.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Para melhor análise, exporte com mídia. Imagens serão registradas, mas não analisadas nesta versão.
                    </p>
                  </div>
                </div>
              </div>

              {/* LGPD notice */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-secondary/30">
                <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                <span>
                  Ao importar, você confirma que possui autorização para uso desta conversa no atendimento da clínica.
                </span>
              </div>

              {/* Upload area */}
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={handleZipFileChange}
              />

              {zipFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileArchive className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-foreground truncate max-w-[200px]">{zipFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        — {formatFileSize(zipFile.size)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZipFile(null)}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={whatsappUploading}
                    >
                      Remover
                    </Button>
                  </div>

                  {/* WhatsApp upload progress */}
                  {whatsappUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-green-400" />
                          {whatsappStatus}
                        </span>
                        {whatsappProgress > 0 && (
                          <span className="text-sm font-mono text-green-400">{whatsappProgress}%</span>
                        )}
                      </div>
                      <Progress value={whatsappProgress} className="h-2 [&>div]:bg-green-500" />
                      {whatsappProgress >= 50 && whatsappProgress < 100 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processando mensagens e transcrevendo áudios... isso pode levar alguns minutos.
                        </p>
                      )}
                      {whatsappProgress === 100 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-400" />
                          Conversa processada com sucesso!
                        </p>
                      )}
                    </div>
                  )}


                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                    zipDragging ? "border-green-500 bg-green-500/5" : "border-border hover:border-green-500/50"
                  }`}
                  onClick={() => zipInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setZipDragging(true); }}
                  onDragLeave={() => setZipDragging(false)}
                  onDrop={handleZipDrop}
                >
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                    <FileArchive className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Arraste o .zip do WhatsApp ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">Formato: .zip exportado pelo WhatsApp — até {ZIP_MAX_SIZE_MB}MB</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Progress (for audio tabs) */}
      {uploading && uploadProgress > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              Enviando áudio...
            </span>
            <span className="text-sm font-mono text-blue-400">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2 [&>div]:bg-blue-500" />
          {uploadProgress === 100 && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-400" />
              Upload concluído, processando...
            </p>
          )}
        </div>
      )}

      {/* Submit button — upload tab */}
      {activeTab === "upload" && (
        <>
          <Button
            onClick={handleSubmit}
            disabled={!leadId || uploading || createCall.isPending || (audioDuration !== null && audioDuration > MAX_DURATION_SECONDS)}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl"
          >
            {uploading || createCall.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {uploading ? "Enviando áudio..." : "Registrando..."}
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Registrar interação com áudio
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            O áudio será transcrito e analisado automaticamente pela IA
          </p>
        </>
      )}

      {/* Submit button — whatsapp tab */}
      {activeTab === "whatsapp" && (
        <>
          <Button
            onClick={handleWhatsAppSubmit}
            disabled={!leadId || !zipFile || whatsappUploading || createCall.isPending}
            className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl"
          >
            {whatsappUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Importando...
              </>
            ) : (
              <>
                <MessageSquare className="h-5 w-5 mr-2" />
                Importar Conversa
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            As mensagens serão processadas e analisadas automaticamente pela IA
          </p>
        </>
      )}
    </div>
  );
}
