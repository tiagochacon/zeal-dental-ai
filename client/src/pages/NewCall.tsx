import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mic, Square, Upload, Phone, FileAudio, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE_MB = 100; // 100MB max file size
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes
const MAX_DURATION_MINUTES = 30;

export default function NewCall() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get query params
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    };
  }, []);

  // Get audio duration when a file is loaded
  const handleAudioLoaded = useCallback(() => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setAudioDuration(Math.round(audioRef.current.duration));
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioFileName(null);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000); // Collect data every second for progressive recording
      setIsRecording(true);
      setRecordingTime(0);
      setAudioDuration(null);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          const newTime = t + 1;
          // Auto-stop at 30 minutes
          if (newTime >= MAX_DURATION_SECONDS) {
            stopRecording();
            toast.info("Gravação encerrada automaticamente — limite de 30 minutos atingido.");
          }
          return newTime;
        });
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
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
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Arquivo muito grande (${formatFileSize(file.size)}). Tamanho máximo: ${MAX_FILE_SIZE_MB}MB`);
      return;
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

  /**
   * Upload audio using multipart form data (supports large files up to 100MB)
   */
  const uploadAudioMultipart = async (callId: number, blob: Blob, durationSec: number): Promise<void> => {
    const formData = new FormData();
    
    // Determine filename
    const ext = blob.type.includes("webm") ? "webm" : 
                blob.type.includes("mp3") || blob.type.includes("mpeg") ? "mp3" :
                blob.type.includes("wav") ? "wav" :
                blob.type.includes("m4a") || blob.type.includes("mp4") ? "m4a" :
                blob.type.includes("ogg") ? "ogg" : "audio";
    
    formData.append("file", blob, `recording.${ext}`);
    formData.append("callId", String(callId));
    formData.append("durationSeconds", String(durationSec));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
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

      xhr.addEventListener("error", () => {
        reject(new Error("Erro de rede durante o upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload cancelado"));
      });

      xhr.open("POST", "/api/calls/upload-audio");
      // Cookies are sent automatically (same-origin)
      xhr.send(formData);
    });
  };

  const handleSubmit = async () => {
    if (!leadId || !leadName.trim()) {
      toast.error("Selecione um lead");
      return;
    }

    // Validate duration for uploaded files
    if (audioDuration && audioDuration > MAX_DURATION_SECONDS) {
      toast.error(`Duração máxima permitida: ${MAX_DURATION_MINUTES} minutos. Este áudio tem ${Math.ceil(audioDuration / 60)} minutos.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // Step 1: Create the call record
      const call = await createCall.mutateAsync({
        leadId,
        leadName: leadName.trim(),
      });

      // Step 2: Upload audio using multipart (supports large files)
      if (audioBlob && call.id) {
        const duration = audioDuration || recordingTime || 0;
        await uploadAudioMultipart(call.id, audioBlob, duration);
        toast.success("Ligação registrada e áudio enviado com sucesso!");
      } else {
        toast.success("Ligação registrada!");
      }

      setLocation(`/calls/${call.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar ligação");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const leads = (leadsQuery.data || []).filter((l: any) => !l.isConverted);

  // Calculate remaining recording time
  const remainingTime = MAX_DURATION_SECONDS - recordingTime;
  const isNearLimit = remainingTime <= 60; // Last minute warning

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-3xl font-bold text-foreground">Nova Ligação</h1>
        <p className="text-sm text-muted-foreground">Registre uma ligação com um lead — suporta áudios de até {MAX_DURATION_MINUTES} minutos</p>
      </div>
        {/* Select Lead */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Selecionar Lead</h2>
          
          {preLeadId ? (
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Phone className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-foreground">{leadName}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.length === 0 ? (
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

        {/* Audio Recording */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Áudio da Ligação</h2>

          <Tabs defaultValue="record">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="record" className="flex-1">
                <Mic className="h-4 w-4 mr-2" />
                Gravar Agora
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Enviar Arquivo
              </TabsTrigger>
            </TabsList>

            {/* Tab: Gravar Agora */}
            <TabsContent value="record">
              <div className="flex flex-col items-center gap-4">
                {!audioBlob || audioFileName ? (
                  <>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? isNearLimit
                          ? "bg-amber-500/20 border-2 border-amber-500 animate-pulse"
                          : "bg-red-500/20 border-2 border-red-500 animate-pulse"
                        : "bg-blue-600/20 border-2 border-blue-500"
                    }`}>
                      {isRecording ? (
                        <button onClick={stopRecording} className="w-full h-full flex items-center justify-center">
                          <Square className="h-8 w-8 text-red-400" />
                        </button>
                      ) : (
                        <button onClick={startRecording} className="w-full h-full flex items-center justify-center">
                          <Mic className="h-8 w-8 text-blue-400" />
                        </button>
                      )}
                    </div>
                    {isRecording ? (
                      <div className="text-center space-y-2">
                        <p className={`text-2xl font-mono ${isNearLimit ? "text-amber-400" : "text-red-400"}`}>
                          {formatTime(recordingTime)}
                        </p>
                        <p className="text-sm text-muted-foreground">Gravando...</p>
                        
                        {/* Recording progress bar */}
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
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Clique para iniciar a gravação</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          Máximo: {MAX_DURATION_MINUTES} minutos
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <audio 
                      ref={audioRef}
                      controls 
                      src={audioUrl || undefined} 
                      className="w-full" 
                      onLoadedMetadata={handleAudioLoaded}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); setAudioDuration(null); }}
                      >
                        Gravar novamente
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Duração: {formatTime(recordingTime || audioDuration || 0)}</span>
                      {audioBlob && <span>Tamanho: {formatFileSize(audioBlob.size)}</span>}
                    </div>
                  </>
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
                      onClick={() => { setAudioBlob(null); setAudioUrl(null); setAudioFileName(null); setAudioDuration(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Remover
                    </Button>
                  </div>
                  
                  {/* Duration info */}
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

                  {/* File size warning for very large files */}
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
          </Tabs>
        </div>

        {/* Upload Progress */}
        {uploading && uploadProgress > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
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

        {/* Submit */}
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
              Registrar Ligação
            </>
          )}
        </Button>

      <p className="text-xs text-muted-foreground text-center mt-3">
        A gravação será transcrita e analisada automaticamente pela IA
      </p>
    </div>
  );
}
