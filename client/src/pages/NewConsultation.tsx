import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Mic, Square, Upload, Play, Pause, AlertCircle, FileText, User, AudioLines, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UpgradeModal, type UpgradeModalTrigger } from "@/components/UpgradeModal";
import { useUsageLimit, getTriggerFromError } from "@/hooks/useUsageLimit";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Paciente", icon: User },
  { id: 2, label: "Consulta", icon: AudioLines },
] as const;

export default function NewConsultation() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [newPatientName, setNewPatientName] = useState("");
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [inputMode, setInputMode] = useState<"audio" | "text">("audio");
  const [consultationText, setConsultationText] = useState("");

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeModalTrigger>("trial_limit");
  const usageLimit = useUsageLimit();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadingChunk, setUploadingChunk] = useState(false);
  const [chunksUploaded, setChunksUploaded] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingSessionIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const currentConsultationIdRef = useRef<number | null>(null);

  // Queries
  const { data: patients, isLoading: patientsLoading } = trpc.patients.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Mutations
  const createPatientMutation = trpc.patients.create.useMutation();
  const createConsultationMutation = trpc.consultations.create.useMutation();
  const uploadAudioMutation = trpc.consultations.uploadAudio.useMutation();
  const uploadAudioChunkMutation = trpc.consultations.uploadAudioChunk.useMutation();
  const finalizeAudioRecordingMutation = trpc.consultations.finalizeAudioRecording.useMutation();
  const updateTranscriptMutation = trpc.consultations.updateTranscript.useMutation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [audioUrl]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock não suportado ou falhou:', err);
    }
  };

  const ensurePatientAndConsultation = async (): Promise<{ patientId: number; patientName: string; consultationId: number }> => {
    let patientId: number;
    let patientName: string;

    if (isNewPatient && newPatientName) {
      const normalizedName = newPatientName.trim().toLowerCase();
      const existingPatient = patients?.find(
        (p) => p.name.trim().toLowerCase() === normalizedName
      );
      if (existingPatient) {
        // Reutilizar paciente existente em vez de bloquear
        patientId = existingPatient.id;
        patientName = existingPatient.name;
      } else {
        const result = await createPatientMutation.mutateAsync({ name: newPatientName });
        patientId = result.patient.id;
        patientName = newPatientName;
      }
    } else {
      patientId = parseInt(selectedPatientId);
      patientName = patients?.find((p) => p.id === patientId)?.name || "";
    }

    const consultationResult = await createConsultationMutation.mutateAsync({
      patientId,
      patientName,
    });

    return {
      patientId,
      patientName,
      consultationId: consultationResult.consultationId,
    };
  };

  const startRecording = async () => {
    try {
      if (!isStep1Valid) {
        toast.error("Selecione ou cadastre um paciente antes de gravar.");
        return;
      }

      const { consultationId } = await ensurePatientAndConsultation();
      currentConsultationIdRef.current = consultationId;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordingSessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      chunkIndexRef.current = 0;
      setChunksUploaded(0);

      requestWakeLock();

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          if (currentConsultationIdRef.current && !uploadingChunk) {
            setUploadingChunk(true);
            try {
              const base64 = await blobToBase64(e.data);
              await uploadAudioChunkMutation.mutateAsync({
                consultationId: currentConsultationIdRef.current,
                recordingSessionId: recordingSessionIdRef.current!,
                chunkIndex: chunkIndexRef.current,
                audioBase64: base64,
                mimeType: "audio/webm",
                durationSeconds: 60,
              });
              chunkIndexRef.current += 1;
              setChunksUploaded((prev) => prev + 1);
            } catch (error) {
              console.error("Erro ao enviar chunk:", error);
            } finally {
              setUploadingChunk(false);
            }
          }
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      };

      mediaRecorder.start(60000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error("Error starting recording:", error);
      if (
        error?.data?.code === "FORBIDDEN" ||
        error?.message?.includes("LIMIT_EXCEEDED") ||
        error?.message?.includes("Limite")
      ) {
        const trigger = error?.message?.includes("LIMIT_EXCEEDED")
          ? getTriggerFromError(error.message)
          : usageLimit.getUpgradeTrigger() || "trial_limit";
        setUpgradeTrigger(trigger);
        setShowUpgradeModal(true);
        return;
      }
      if (error?.message?.includes("paciente")) {
        toast.error(error.message);
        return;
      }
      toast.error("Erro ao acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/flac'];
      if (!file.type.startsWith('audio/') && !validTypes.some(type => file.type.includes(type.split('/')[1]))) {
        toast.error('Formato de arquivo não suportado. Use MP3, WAV, M4A, WebM, OGG ou FLAC.');
        return;
      }
      const maxSize = 1.5 * 1024 * 1024 * 1024; // 1.5GB
      if (file.size > maxSize) {
        toast.error('Arquivo muito grande. O limite é 1.5GB.');
        return;
      }
      // Show size info for large files
      const sizeMB = (file.size / (1024 * 1024)).toFixed(0);
      if (file.size > 100 * 1024 * 1024) {
        toast.info(`Arquivo de ${sizeMB}MB detectado. O upload pode levar alguns minutos.`);
      }
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const resetAudio = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    setChunksUploaded(0);
    currentConsultationIdRef.current = null;
    recordingSessionIdRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step validation
  const isStep1Valid = isNewPatient ? newPatientName.trim().length > 0 : selectedPatientId !== "";
  const isStep2Valid = inputMode === "audio" ? !!audioBlob : consultationText.trim().length > 0;

  const selectedPatientName = isNewPatient
    ? newPatientName
    : patients?.find((p) => p.id === parseInt(selectedPatientId))?.name || "";

  const uploadAudioMultipart = async (
    consultationId: number,
    blob: Blob,
    durationSec: number
  ): Promise<void> => {
    const ext = blob.type.includes("webm")
      ? "webm"
      : blob.type.includes("mp3") || blob.type.includes("mpeg")
        ? "mp3"
        : blob.type.includes("mp4") || blob.type.includes("m4a") || blob.type.includes("aac")
          ? "m4a"
          : blob.type.includes("ogg")
            ? "ogg"
            : blob.type.includes("wav")
              ? "wav"
              : "webm";

    const filename =
      blob instanceof File && blob.name ? blob.name : `recording.${ext}`;

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("consultationId", String(consultationId));
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

      xhr.addEventListener("error", () =>
        reject(new Error("Erro de rede durante o upload"))
      );
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelado")));

      xhr.open("POST", "/api/consultations/upload-audio");
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
    }
  };

  const handleSubmit = async () => {
    if (inputMode === "audio" && !audioBlob) {
      toast.error("Por favor, grave ou faça upload de um áudio.");
      return;
    }
    if (inputMode === "text" && !consultationText.trim()) {
      toast.error("Por favor, digite o texto da consulta.");
      return;
    }
    if (!selectedPatientId && !newPatientName) {
      toast.error("Por favor, selecione ou cadastre um paciente.");
      return;
    }

    const usedProgressiveRecording =
      recordingSessionIdRef.current && chunksUploaded > 0;

    try {
      if (inputMode === "audio" && usedProgressiveRecording) {
        const consultationId = currentConsultationIdRef.current;
        if (!consultationId) {
          toast.error("Erro: sessão de gravação inválida. Tente novamente.");
          return;
        }
        await finalizeAudioRecordingMutation.mutateAsync({
          consultationId,
          recordingSessionId: recordingSessionIdRef.current!,
          totalDurationSeconds: recordingTime,
        });
        toast.success("Gravação finalizada com sucesso!");
        setLocation(`/consultation/${consultationId}/review`);
        return;
      }

      const { patientId, patientName, consultationId } =
        await ensurePatientAndConsultation();

      if (inputMode === "audio" && audioBlob) {
        const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB
        const useMultipart = audioBlob.size > MULTIPART_THRESHOLD;

        try {
          if (useMultipart) {
            setIsUploading(true);
            setUploadProgress(0);
            toast.info("Enviando áudio... Isso pode levar alguns minutos para arquivos grandes.");
            await uploadAudioMultipart(consultationId, audioBlob, recordingTime || 0);
          } else {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const b64 = (reader.result as string).split(",")[1];
                resolve(b64 || "");
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });
            await uploadAudioMutation.mutateAsync({
              consultationId,
              audioBase64: base64,
              mimeType: audioBlob.type || "audio/webm",
              durationSeconds: recordingTime || undefined,
            });
          }
          toast.success("Áudio enviado com sucesso!");
          setLocation(`/consultation/${consultationId}/review`);
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      } else if (inputMode === "text") {
        await updateTranscriptMutation.mutateAsync({
          consultationId,
          transcript: consultationText,
        });
        toast.success("Consulta criada com sucesso!");
        setLocation(`/consultation/${consultationId}/review`);
      }
    } catch (error: any) {
      console.error("Error creating consultation:", error);
      if (
        error?.data?.code === "FORBIDDEN" ||
        error?.message?.includes("LIMIT_EXCEEDED") ||
        error?.message?.includes("Limite")
      ) {
        const trigger = error?.message?.includes("LIMIT_EXCEEDED")
          ? getTriggerFromError(error.message)
          : usageLimit.getUpgradeTrigger() || "trial_limit";
        setUpgradeTrigger(trigger);
        setShowUpgradeModal(true);
        return;
      }
      toast.error("Erro ao criar consulta. Tente novamente.");
    }
  };

  const isSubmitting = createPatientMutation.isPending ||
                       createConsultationMutation.isPending ||
                       uploadAudioMutation.isPending ||
                       finalizeAudioRecordingMutation.isPending ||
                       updateTranscriptMutation.isPending ||
                       isUploading;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-3xl mx-auto space-y-4 lg:space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Page Header */}
      <div className="flex items-center gap-2 lg:gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-1 lg:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div>
          <h1 className="text-lg lg:text-xl font-bold">Nova Consulta</h1>
          <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
            Siga os passos para registrar a consulta
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 px-2">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => {
                  if (isCompleted) setCurrentStep(step.id);
                }}
                disabled={!isCompleted && !isActive}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                  isActive && "bg-primary/15 text-primary",
                  isCompleted && "text-emerald-500 cursor-pointer hover:bg-emerald-500/10",
                  !isActive && !isCompleted && "text-muted-foreground cursor-default"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && "bg-emerald-500 text-white",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                  isCompleted ? "bg-emerald-500" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 lg:space-y-6"
          >
            {/* Patient Selection */}
            <Card>
              <CardHeader className="p-4 lg:p-6">
                <CardTitle className="text-base lg:text-lg">Paciente</CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Selecione um paciente existente ou cadastre um novo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <Button
                    variant={!isNewPatient ? "default" : "outline"}
                    onClick={() => setIsNewPatient(false)}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    Paciente Existente
                  </Button>
                  <Button
                    variant={isNewPatient ? "default" : "outline"}
                    onClick={() => setIsNewPatient(true)}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    Novo Paciente
                  </Button>
                </div>

                {isNewPatient ? (
                  <div className="space-y-2">
                    <Label htmlFor="patientName" className="text-sm">Nome do Paciente</Label>
                    <Input
                      id="patientName"
                      placeholder="Digite o nome completo"
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm">Selecione o Paciente</Label>
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patientsLoading ? (
                          <div className="p-2 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </div>
                        ) : patients?.length === 0 ? (
                          <div className="p-2 text-center text-muted-foreground text-sm">
                            Nenhum paciente cadastrado
                          </div>
                        ) : (
                          patients?.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id.toString()}>
                              {patient.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Lead Profile Tip */}
                {selectedPatientId && (() => {
                  const selectedPatient = patients?.find(p => p.id === parseInt(selectedPatientId));
                  if (selectedPatient && (selectedPatient as any).originLeadId) {
                    return (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs font-semibold text-amber-400 mb-1">Dica do CRC:</p>
                        <p className="text-sm text-foreground">
                          Este paciente veio de uma prospecção comercial. Consulte o histórico de ligações para entender o perfil.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>

            {/* Next Step Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleNextStep}
              disabled={!isStep1Valid}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 lg:space-y-6"
          >
            {/* Selected Patient Mini-Card */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 lg:p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedPatientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {isNewPatient ? "Novo paciente" : "Paciente existente"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
                  Alterar
                </Button>
              </CardContent>
            </Card>

            {/* Input Mode Selection */}
            <Card>
              <CardHeader className="p-4 lg:p-6">
                <CardTitle className="text-base lg:text-lg">Entrada da Consulta</CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Escolha como deseja registrar a consulta
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "audio" | "text")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="audio" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm">
                      <Mic className="h-4 w-4" />
                      Áudio
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm">
                      <FileText className="h-4 w-4" />
                      Texto
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="audio" className="mt-4 lg:mt-6">
                    {!audioBlob ? (
                      <>
                        <div className="flex flex-col items-center gap-4 lg:gap-6 py-6 lg:py-8">
                          {isRecording ? (
                            <>
                              <div className="relative">
                                <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-destructive/20 flex items-center justify-center">
                                  <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-destructive animate-pulse flex items-center justify-center">
                                    <Mic className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
                                  </div>
                                </div>
                              </div>
                              <div className="text-2xl lg:text-3xl font-mono font-bold">
                                {formatTime(recordingTime)}
                              </div>
                              {chunksUploaded > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${uploadingChunk ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                  {uploadingChunk ? 'Enviando...' : `${chunksUploaded} chunk(s) enviado(s)`}
                                </div>
                              )}
                              <p className="text-xs text-center text-muted-foreground max-w-sm px-4">
                                Mantenha a tela ativa para melhor qualidade de gravação
                              </p>
                              <div className="flex gap-2 lg:gap-4">
                                <Button variant="outline" size="sm" onClick={pauseRecording}>
                                  {isPaused ? <Play className="h-4 w-4 mr-1 lg:mr-2" /> : <Pause className="h-4 w-4 mr-1 lg:mr-2" />}
                                  {isPaused ? 'Continuar' : 'Pausar'}
                                </Button>
                                <Button variant="destructive" size="sm" onClick={stopRecording}>
                                  <Square className="h-4 w-4 mr-1 lg:mr-2" />
                                  Parar
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <Button
                                size="lg"
                                className="h-20 w-20 lg:h-24 lg:w-24 rounded-full"
                                onClick={startRecording}
                              >
                                <Mic className="h-8 w-8 lg:h-10 lg:w-10" />
                              </Button>
                              <p className="text-sm text-muted-foreground text-center">
                                Clique para iniciar a gravação
                              </p>
                            </>
                          )}
                        </div>

                        {!isRecording && (
                          <>
                            <div className="relative my-4 lg:my-6">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">ou</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-center gap-3 lg:gap-4">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Fazer Upload de Áudio
                              </Button>
                              <p className="text-xs text-muted-foreground text-center">
                                Formatos aceitos: MP3, WAV, M4A, WebM, OGG, FLAC (máx. 1.5GB)
                              </p>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 lg:p-4 rounded-lg bg-muted">
                          <audio src={audioUrl || undefined} controls className="w-full" />
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {recordingTime > 0 ? `Duração: ${formatTime(recordingTime)}` : 'Áudio carregado'}
                          </p>
                          <Button variant="outline" size="sm" onClick={resetAudio}>
                            Gravar Novamente
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="text" className="mt-4 lg:mt-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="consultationText" className="text-sm">Texto da Consulta</Label>
                        <Textarea
                          id="consultationText"
                          placeholder={`Digite ou cole o texto da consulta aqui...\n\nExemplo:\nDentista: Bom dia, como posso ajudar?\nPaciente: Estou sentindo dor no dente 25.\nDentista: Há quanto tempo sente essa dor?\n...`}
                          className="min-h-[200px] lg:min-h-[300px] resize-none text-sm"
                          value={consultationText}
                          onChange={(e) => setConsultationText(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dica: Identifique claramente as falas do dentista e do paciente para melhor análise.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4 lg:pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-xs lg:text-sm">
                    <p className="font-medium text-primary mb-1">
                      {inputMode === "audio" ? "Dicas para melhor transcrição" : "Dicas para melhor análise"}
                    </p>
                    <ul className="text-muted-foreground space-y-1">
                      {inputMode === "audio" ? (
                        <>
                          <li>• Fale claramente e em volume normal</li>
                          <li>• Evite ruídos de fundo quando possível</li>
                          <li>• Identifique-se como dentista no início</li>
                          <li>• Mencione claramente os números dos dentes</li>
                        </>
                      ) : (
                        <>
                          <li>• Use "Dentista:" e "Paciente:" para identificar falas</li>
                          <li>• Inclua todas as informações clínicas relevantes</li>
                          <li>• Mencione claramente os números dos dentes</li>
                          <li>• Descreva sintomas, histórico e observações</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!isStep2Valid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploading || uploadProgress > 0
                    ? `Enviando áudio... ${uploadProgress}%`
                    : finalizeAudioRecordingMutation.isPending
                      ? 'Finalizando gravação...'
                      : 'Processando...'}
                </>
              ) : (
                inputMode === "audio"
                  ? "Continuar para Transcrição"
                  : "Continuar para Revisão"
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        trigger={upgradeTrigger}
        currentPlan={usageLimit.currentPlan}
        consultationsUsed={usageLimit.consultationsUsed}
        consultationsLimit={usageLimit.consultationsLimit}
      />
    </motion.div>
  );
}
