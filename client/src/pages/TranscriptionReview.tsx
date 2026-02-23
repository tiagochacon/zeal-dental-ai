import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Play, Pause, Check, Edit2, AudioLines, FileText } from "lucide-react";
import { UpgradeModal, type UpgradeModalTrigger } from "@/components/UpgradeModal";
import { useUsageLimit, getTriggerFromError } from "@/hooks/useUsageLimit";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";

export default function TranscriptionReview() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const consultationId = params.id ? parseInt(params.id) : null;
  
  const { user, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeModalTrigger>("trial_limit");
  const usageLimit = useUsageLimit();
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
      toast.success("Transcrição atualizada com sucesso!");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar transcrição. Tente novamente.");
    },
  });

  const generateSOAPMutation = trpc.consultations.analyzeAndGenerateSOAP.useMutation({
    onSuccess: () => {
      toast.success("Notas Clínicas geradas com sucesso!");
      setLocation(`/consultation/${consultationId}`);
    },
    onError: (error: any) => {
      if (error.data?.code === 'FORBIDDEN' || 
          error.message?.includes('LIMIT_EXCEEDED') || 
          error.message?.includes('Limite')) {
        const trigger = error?.message?.includes('LIMIT_EXCEEDED') 
          ? getTriggerFromError(error.message)
          : usageLimit.getUpgradeTrigger() || 'trial_limit';
        setUpgradeTrigger(trigger);
        setShowUpgradeModal(true);
      } else {
        toast.error(`Erro ao gerar Notas Clínicas: ${error.message}`);
      }
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
    return <DashboardLayoutSkeleton />;
  }

  if (!consultation) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-4">
        <Card className="max-w-md w-full">
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
    <motion.div
      className="max-w-4xl mx-auto space-y-4 lg:space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">{consultation.patientName}</h1>
          <p className="text-sm text-muted-foreground">Revisão da Transcrição</p>
        </div>
      </div>

      {/* Audio Player */}
      {consultation.audioUrl && (
        <Card>
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <AudioLines className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Áudio da Consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
            <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleAudio}
                className="h-10 w-10 lg:h-12 lg:w-12 rounded-full shrink-0"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 lg:h-5 lg:w-5" />
                ) : (
                  <Play className="h-4 w-4 lg:h-5 lg:w-5" />
                )}
              </Button>
              <audio
                ref={audioRef}
                src={consultation.audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="w-full"
                controls
              />
            </div>
            {consultation.audioDurationSeconds && (
              <p className="text-xs lg:text-sm text-muted-foreground mt-2">
                Duração: {Math.floor(consultation.audioDurationSeconds / 60)}:{(consultation.audioDurationSeconds % 60).toString().padStart(2, '0')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcription */}
      <Card>
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <FileText className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Transcrição
            </CardTitle>
            {consultation.transcript && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1 lg:mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
          {!consultation.transcript ? (
            <div className="text-center py-6 lg:py-8">
              {transcribeMutation.isPending ? (
                <div className="space-y-4">
                  <Loader2 className="h-10 w-10 lg:h-12 lg:w-12 animate-spin text-primary mx-auto" />
                  <div>
                    <p className="font-medium text-sm lg:text-base">Transcrevendo áudio...</p>
                    <p className="text-xs lg:text-sm text-muted-foreground">
                      Isso pode levar alguns minutos dependendo da duração do áudio
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <AudioLines className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium text-sm lg:text-base">Áudio pronto para transcrição</p>
                    <p className="text-xs lg:text-sm text-muted-foreground mb-4">
                      Clique no botão abaixo para iniciar a transcrição automática
                    </p>
                    <Button onClick={handleTranscribe} size="sm" disabled={transcribeMutation.isPending}>
                      {transcribeMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Transcrevendo...
                        </>
                      ) : (
                        "Iniciar Transcrição"
                      )}
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
                className="min-h-[250px] lg:min-h-[400px] font-mono text-xs lg:text-sm"
                placeholder="Transcrição da consulta..."
              />
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTranscript(consultation.transcript || "");
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveTranscript} size="sm" disabled={updateTranscriptMutation.isPending}>
                  {updateTranscriptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-xs lg:text-sm leading-relaxed bg-muted/50 p-3 lg:p-4 rounded-lg max-h-[400px] overflow-y-auto">
                {consultation.transcript}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {consultation.transcript && !isEditing && (
        <div className="flex flex-col sm:flex-row justify-end gap-2 lg:gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4 mr-1 lg:mr-2" />
            Editar Transcrição
          </Button>
          <Button
            onClick={handleConfirmAndAnalyze}
            disabled={isProcessing}
            size="sm"
            className="lg:text-base"
          >
            {generateSOAPMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando Notas Clínicas...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1 lg:mr-2" />
                Confirmar e Gerar Notas Clínicas
              </>
            )}
          </Button>
        </div>
      )}

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
