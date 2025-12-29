import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Play, Pause, Check, Edit2, AudioLines, FileText } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function TranscriptionReview() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const consultationId = params.id ? parseInt(params.id) : null;
  
  const { user, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: consultation, isLoading, refetch } = trpc.consultations.getById.useQuery(
    { id: consultationId! },
    { enabled: !!user && !!consultationId }
  );

  const transcribeMutation = trpc.consultations.transcribe.useMutation({
    onSuccess: () => {
      toast.success("Transcrição concluída!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro na transcrição: ${error.message}`);
    },
  });

  const updateTranscriptMutation = trpc.consultations.updateTranscript.useMutation({
    onSuccess: () => {
      toast.success("Transcrição atualizada!");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar transcrição");
    },
  });

  const generateSOAPMutation = trpc.consultations.analyzeAndGenerateSOAP.useMutation({
    onSuccess: () => {
      toast.success("Nota SOAP gerada com sucesso!");
      setLocation(`/consultation/${consultationId}`);
    },
    onError: (error) => {
      toast.error(`Erro ao gerar nota SOAP: ${error.message}`);
    },
  });

  useEffect(() => {
    if (consultation?.transcript) {
      setEditedTranscript(consultation.transcript);
    }
  }, [consultation?.transcript]);

  const handleTranscribe = () => {
    if (!consultationId) return;
    transcribeMutation.mutate({ consultationId });
  };

  const handleSaveTranscript = () => {
    if (!consultationId) return;
    updateTranscriptMutation.mutate({
      consultationId,
      transcript: editedTranscript,
    });
  };

  const handleConfirmAndAnalyze = () => {
    if (!consultationId) return;
    
    // Save any edits first
    if (isEditing && editedTranscript !== consultation?.transcript) {
      updateTranscriptMutation.mutate(
        { consultationId, transcript: editedTranscript },
        {
          onSuccess: () => {
            generateSOAPMutation.mutate({ consultationId });
          },
        }
      );
    } else {
      generateSOAPMutation.mutate({ consultationId });
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (authLoading || isLoading) {
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

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Consulta não encontrada</p>
            <Button onClick={() => setLocation("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProcessing = transcribeMutation.isPending || 
                       updateTranscriptMutation.isPending || 
                       generateSOAPMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold">{consultation.patientName}</h1>
                <p className="text-sm text-muted-foreground">
                  Revisão da Transcrição
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Audio Player */}
          {consultation.audioUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AudioLines className="h-5 w-5 text-primary" />
                  Áudio da Consulta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleAudio}
                    className="h-12 w-12 rounded-full"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                  <audio
                    ref={audioRef}
                    src={consultation.audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="flex-1"
                    controls
                  />
                </div>
                {consultation.audioDurationSeconds && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Duração: {Math.floor(consultation.audioDurationSeconds / 60)}:{(consultation.audioDurationSeconds % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transcription */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Transcrição
                </CardTitle>
                {consultation.transcript && !isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!consultation.transcript ? (
                <div className="text-center py-8">
                  {transcribeMutation.isPending ? (
                    <div className="space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                      <div>
                        <p className="font-medium">Transcrevendo áudio...</p>
                        <p className="text-sm text-muted-foreground">
                          Isso pode levar alguns minutos dependendo da duração do áudio
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AudioLines className="h-12 w-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="font-medium">Áudio pronto para transcrição</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Clique no botão abaixo para iniciar a transcrição automática
                        </p>
                        <Button onClick={handleTranscribe}>
                          Iniciar Transcrição
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : isEditing ? (
                <div className="space-y-4">
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Transcrição da consulta..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedTranscript(consultation.transcript || "");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveTranscript} disabled={updateTranscriptMutation.isPending}>
                      {updateTranscriptMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Alterações'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                    {consultation.transcript}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {consultation.transcript && !isEditing && (
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Editar Transcrição
              </Button>
              <Button
                onClick={handleConfirmAndAnalyze}
                disabled={isProcessing}
                size="lg"
              >
                {generateSOAPMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando Nota SOAP...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar e Gerar Nota SOAP
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
