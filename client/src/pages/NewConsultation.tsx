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
import { AudioRecorder } from "@/components/consultations/AudioRecorder";

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

  // Audio recording state
  const [consultationId, setConsultationId] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingConsultation, setIsCreatingConsultation] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeModalTrigger>("trial_limit");
  const usageLimit = useUsageLimit();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: patients, isLoading: patientsLoading } = trpc.patients.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Mutations
  const createPatientMutation = trpc.patients.create.useMutation();
  const createConsultationMutation = trpc.consultations.create.useMutation();
  const uploadAudioMutation = trpc.consultations.uploadAudio.useMutation();
  const updateTranscriptMutation = trpc.consultations.updateTranscript.useMutation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const ensureConsultation = async (): Promise<number> => {
    if (consultationId) return consultationId;

    let patientId: number;
    let patientName: string;

    if (isNewPatient && newPatientName) {
      const normalizedName = newPatientName.trim().toLowerCase();
      const existingPatient = patients?.find(
        (p) => p.name.trim().toLowerCase() === normalizedName
      );
      if (existingPatient) {
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

    const cIdNum = Number(consultationResult.consultationId);
    setConsultationId(cIdNum);
    return cIdNum;
  };

  // Called when user enters step 2 with audio mode — create consultation eagerly
  const handleStartAudioMode = async () => {
    if (consultationId) return; // already created
    setIsCreatingConsultation(true);
    try {
      await ensureConsultation();
    } catch (error: any) {
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
    } finally {
      setIsCreatingConsultation(false);
    }
  };

  // When AudioRecorder finishes transcription, save and navigate
  const handleTranscriptReady = async (transcript: string) => {
    if (!consultationId) {
      toast.error("Erro: consulta não encontrada.");
      return;
    }
    try {
      await updateTranscriptMutation.mutateAsync({
        consultationId: Number(consultationId),
        transcript,
      });
      toast.success("Transcrição concluída!");
      setLocation(`/consultation/${consultationId}/review`);
    } catch (error: any) {
      console.error("Error saving transcript:", error);
      toast.error("Erro ao salvar transcrição.");
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
    setConsultationId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step validation
  const isStep1Valid = isNewPatient ? newPatientName.trim().length > 0 : selectedPatientId !== "";

  const selectedPatientName = isNewPatient
    ? newPatientName
    : patients?.find((p) => p.id === parseInt(selectedPatientId))?.name || "";

  const uploadAudioMultipart = async (
    cId: number,
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
    formData.append("consultationId", String(cId));
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

  const handleNextStep = async () => {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
      // Pre-create consultation for audio mode
      if (inputMode === "audio") {
        await handleStartAudioMode();
      }
    }
  };

  // Submit for file upload or text mode
  const handleSubmit = async () => {
    if (inputMode === "text" && !consultationText.trim()) {
      toast.error("Por favor, digite o texto da consulta.");
      return;
    }
    if (inputMode === "audio" && audioBlob) {
      // File upload flow (not progressive recording)
      try {
        const cId = await ensureConsultation();
        const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
        const useMultipart = audioBlob.size > MULTIPART_THRESHOLD;

        try {
          if (useMultipart) {
            setIsUploading(true);
            setUploadProgress(0);
            toast.info("Enviando áudio... Isso pode levar alguns minutos para arquivos grandes.");
            await uploadAudioMultipart(cId, audioBlob, 0);
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
              consultationId: cId,
              audioBase64: base64,
              mimeType: audioBlob.type || "audio/webm",
            });
          }
          toast.success("Áudio enviado com sucesso!");
          setLocation(`/consultation/${cId}/review`);
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      } catch (error: any) {
        console.error("Error uploading audio:", error);
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
        toast.error("Erro ao enviar áudio. Tente novamente.");
      }
      return;
    }

    if (inputMode === "text") {
      try {
        const cId = await ensureConsultation();
        await updateTranscriptMutation.mutateAsync({
          consultationId: cId,
          transcript: consultationText,
        });
        toast.success("Consulta criada com sucesso!");
        setLocation(`/consultation/${cId}/review`);
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
    }
  };

  const isSubmitting = createPatientMutation.isPending ||
                       createConsultationMutation.isPending ||
                       uploadAudioMutation.isPending ||
                       updateTranscriptMutation.isPending ||
                       isUploading;

  const isStep2Valid = inputMode === "text" ? consultationText.trim().length > 0 : !!audioBlob;

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
              disabled={!isStep1Valid || isCreatingConsultation}
            >
              {isCreatingConsultation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
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
                <Tabs value={inputMode} onValueChange={(v) => {
                  setInputMode(v as "audio" | "text");
                  if (v === "audio" && !consultationId) {
                    handleStartAudioMode();
                  }
                }}>
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
                    {consultationId ? (
                      <div className="space-y-4">
                        {/* Progressive AudioRecorder */}
                        <AudioRecorder
                          consultationId={consultationId}
                          onTranscriptReady={handleTranscriptReady}
                          onError={(msg) => toast.error(msg)}
                        />

                        {/* File upload alternative */}
                        {!audioBlob && (
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

                        {/* Uploaded file preview */}
                        {audioBlob && (
                          <div className="space-y-4">
                            <div className="p-3 lg:p-4 rounded-lg bg-muted">
                              <audio src={audioUrl || undefined} controls className="w-full" />
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <p className="text-xs lg:text-sm text-muted-foreground">
                                Áudio carregado
                              </p>
                              <Button variant="outline" size="sm" onClick={resetAudio}>
                                Remover
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Preparando gravação...</p>
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

            {/* Submit Button — only for file upload or text mode */}
            {(inputMode === "text" || (inputMode === "audio" && audioBlob)) && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={
                  (inputMode === "text" && !consultationText.trim()) ||
                  (inputMode === "audio" && !audioBlob) ||
                  isSubmitting
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isUploading || uploadProgress > 0
                      ? `Enviando áudio... ${uploadProgress}%`
                      : 'Processando...'}
                  </>
                ) : (
                  inputMode === "audio"
                    ? "Continuar para Transcrição"
                    : "Continuar para Revisão"
                )}
              </Button>
            )}
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
