import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Mic, Square, Upload, Play, Pause, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function NewConsultation() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [newPatientName, setNewPatientName] = useState("");
  const [isNewPatient, setIsNewPatient] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar o microfone. Verifique as permissões.');
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
      // Validate file type
      const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4'];
      if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
        toast.error('Formato de arquivo não suportado. Use MP3, WAV, M4A ou WebM.');
        return;
      }
      
      // Validate file size (16MB limit)
      if (file.size > 16 * 1024 * 1024) {
        toast.error('Arquivo muito grande. O limite é 16MB.');
        return;
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
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.error('Por favor, grave ou faça upload de um áudio.');
      return;
    }

    if (!selectedPatientId && !newPatientName) {
      toast.error('Por favor, selecione ou cadastre um paciente.');
      return;
    }

    try {
      let patientId: number;
      let patientName: string;

      // Create new patient if needed
      if (isNewPatient && newPatientName) {
        const result = await createPatientMutation.mutateAsync({
          name: newPatientName,
        });
        patientId = result.patient.id;
        patientName = newPatientName;
      } else {
        patientId = parseInt(selectedPatientId);
        patientName = patients?.find(p => p.id === patientId)?.name || '';
      }

      // Create consultation
      const consultationResult = await createConsultationMutation.mutateAsync({
        patientId,
        patientName,
      });

      // Convert blob to base64 and upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        await uploadAudioMutation.mutateAsync({
          consultationId: consultationResult.consultationId,
          audioBase64: base64,
          mimeType: audioBlob.type || 'audio/webm',
          durationSeconds: recordingTime || undefined,
        });

        toast.success('Áudio enviado com sucesso!');
        setLocation(`/consultation/${consultationResult.consultationId}/review`);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error creating consultation:', error);
      toast.error('Erro ao criar consulta. Tente novamente.');
    }
  };

  const isSubmitting = createPatientMutation.isPending || 
                       createConsultationMutation.isPending || 
                       uploadAudioMutation.isPending;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-xl font-bold">Nova Consulta</h1>
              <p className="text-sm text-muted-foreground">
                Grave ou faça upload do áudio da consulta
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Patient Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Paciente</CardTitle>
              <CardDescription>
                Selecione um paciente existente ou cadastre um novo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant={!isNewPatient ? "default" : "outline"}
                  onClick={() => setIsNewPatient(false)}
                >
                  Paciente Existente
                </Button>
                <Button
                  variant={isNewPatient ? "default" : "outline"}
                  onClick={() => setIsNewPatient(true)}
                >
                  Novo Paciente
                </Button>
              </div>

              {isNewPatient ? (
                <div className="space-y-2">
                  <Label htmlFor="patientName">Nome do Paciente</Label>
                  <Input
                    id="patientName"
                    placeholder="Digite o nome completo"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Selecione o Paciente</Label>
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
                        <div className="p-2 text-center text-muted-foreground">
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
            </CardContent>
          </Card>

          {/* Audio Recording */}
          <Card>
            <CardHeader>
              <CardTitle>Áudio da Consulta</CardTitle>
              <CardDescription>
                Grave a consulta em tempo real ou faça upload de um arquivo de áudio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!audioBlob ? (
                <>
                  {/* Recording Controls */}
                  <div className="flex flex-col items-center gap-6 py-8">
                    {isRecording ? (
                      <>
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-destructive recording-pulse flex items-center justify-center">
                              <Mic className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        </div>
                        <div className="text-3xl font-mono font-bold">
                          {formatTime(recordingTime)}
                        </div>
                        <div className="flex gap-4">
                          <Button variant="outline" onClick={pauseRecording}>
                            {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                            {isPaused ? 'Continuar' : 'Pausar'}
                          </Button>
                          <Button variant="destructive" onClick={stopRecording}>
                            <Square className="h-4 w-4 mr-2" />
                            Parar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          size="lg"
                          className="h-24 w-24 rounded-full"
                          onClick={startRecording}
                        >
                          <Mic className="h-10 w-10" />
                        </Button>
                        <p className="text-muted-foreground">
                          Clique para iniciar a gravação
                        </p>
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  {!isRecording && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            ou
                          </span>
                        </div>
                      </div>

                      {/* File Upload */}
                      <div className="flex flex-col items-center gap-4">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Fazer Upload de Áudio
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Formatos aceitos: MP3, WAV, M4A, WebM (máx. 16MB)
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Audio Preview */
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <audio src={audioUrl || undefined} controls className="w-full" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {recordingTime > 0 ? `Duração: ${formatTime(recordingTime)}` : 'Áudio carregado'}
                    </p>
                    <Button variant="outline" onClick={resetAudio}>
                      Gravar Novamente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary mb-1">Dicas para melhor transcrição</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Fale claramente e em volume normal</li>
                    <li>• Evite ruídos de fundo quando possível</li>
                    <li>• Identifique-se como dentista no início da consulta</li>
                    <li>• Mencione claramente os números dos dentes</li>
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
            disabled={!audioBlob || (!selectedPatientId && !newPatientName) || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Continuar para Transcrição'
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
