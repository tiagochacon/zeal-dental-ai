import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { exportSOAPToPDF, exportTreatmentPlanToPDF } from "@/lib/pdfExport";
import Odontogram from "@/components/Odontogram";
import { 
  Loader2, ArrowLeft, FileText, AudioLines, Download, CheckCircle, Edit, 
  AlertTriangle, Stethoscope, ClipboardList, CheckCircle2, Star, TrendingUp,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import type { SOAPNote, TreatmentPlan } from "../../../drizzle/schema";
import { AdaptiveNegotiationTab } from "@/components/negotiation";
import { UpgradeModal } from "@/components/UpgradeModal";
import type { PatientProfile, NeurovendasAnalysis } from "../../../drizzle/schema";

export default function ConsultationDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const consultationId = params.id ? parseInt(params.id) : null;
  
  const { user, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [treatmentClosed, setTreatmentClosed] = useState<boolean | null>(null);
  const [treatmentClosedNotes, setTreatmentClosedNotes] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [planForm, setPlanForm] = useState({
    summary: "",
    stepsText: "",
    medsText: "",
    postOpText: "",
    warningsText: "",
  });
  const [activeTab, setActiveTab] = useState("soap");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: consultation, isLoading, refetch } = trpc.consultations.getById.useQuery(
    { id: consultationId! },
    { enabled: !!user && !!consultationId }
  );

  // Use billing API to check negotiation access (respects clinic inheritance)
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const hasNegotiationAccess = planInfo?.hasNegotiationAccess ?? (user?.role === 'admin');
  
  // Check if this is an old consultation with existing neurovendas data (allow read access)
  const hasExistingNeurovendasData = !!consultation?.neurovendasAnalysis;
  
  // Allow access if user has subscription access OR if consultation already has neurovendas data
  const canAccessNegotiation = hasNegotiationAccess || hasExistingNeurovendasData;

  const { data: existingFeedback } = trpc.feedbacks.getByConsultation.useQuery(
    { consultationId: consultationId! },
    { enabled: !!user && !!consultationId }
  );

  const { data: dentistProfile } = trpc.auth.getProfile.useQuery(
    undefined,
    { enabled: !!user }
  );

  const utils = trpc.useUtils();

  const updateSOAPMutation = trpc.consultations.updateSOAP.useMutation({
    onSuccess: () => {
      toast.success("Notas Clínicas atualizadas!");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar Notas Clínicas");
    },
  });

  const updateTreatmentPlanMutation = trpc.consultations.updateTreatmentPlan.useMutation({
    onSuccess: () => {
      toast.success("Plano de tratamento atualizado!");
      setIsEditingPlan(false);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar plano de tratamento");
    },
  });

  const generateTreatmentPlanMutation = trpc.consultations.generateTreatmentPlan.useMutation({
    onSuccess: () => {
      toast.success("Plano de tratamento gerado!");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao gerar plano de tratamento");
    },
  });

  const createFeedbackMutation = trpc.feedbacks.create.useMutation({
    onSuccess: () => {
      toast.success("Feedback enviado!");
      setShowFeedbackModal(false);
      utils.feedbacks.getByConsultation.invalidate({ consultationId: consultationId! });
    },
    onError: () => {
      toast.error("Erro ao enviar feedback");
    },
  });

  const finalizeMutation = trpc.consultations.finalize.useMutation({
    onSuccess: () => {
      toast.success("Consulta finalizada!");
      refetch();
    },
    onError: (error) => {
      if (error.message.includes("Feedback obrigatório")) {
        setShowFeedbackModal(true);
      } else {
        toast.error("Erro ao finalizar consulta");
      }
    },
  });

  const handleFinalize = () => {
    if (!existingFeedback) {
      setShowFeedbackModal(true);
    } else if (consultationId) {
      finalizeMutation.mutate({ consultationId });
    }
  };

  const handleSubmitFeedback = () => {
    if (feedbackRating === 0) {
      toast.error("Por favor, selecione uma avaliação");
      return;
    }
    if (consultationId) {
      createFeedbackMutation.mutate({
        consultationId,
        rating: feedbackRating,
        comment: feedbackComment || undefined,
        treatmentClosed: treatmentClosed ?? undefined,
        treatmentClosedNotes: treatmentClosedNotes || undefined,
      }, {
        onSuccess: () => {
          finalizeMutation.mutate({ consultationId });
        },
      });
    }
  };

  const handleExportPDF = () => {
    if (!consultation || !consultation.soapNote) {
      toast.error("Notas Clínicas não disponíveis para exportação");
      return;
    }
    try {
      exportSOAPToPDF({
        patientName: consultation.patientName,
        createdAt: consultation.createdAt,
        soapNote: consultation.soapNote as SOAPNote,
        dentistName: dentistProfile?.name,
        dentistCRO: dentistProfile?.croNumber,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
      console.error(error);
    }
  };

  const treatmentPlan = (consultation?.treatmentPlan || null) as TreatmentPlan | null;

  const formatPlanLines = (items: Array<string>) => items.join("\n");

  const formatSteps = (steps: TreatmentPlan["steps"]) =>
    steps
      .map(step =>
        [
          step.title,
          step.description,
          step.duration,
          step.frequency,
          step.notes,
        ]
          .filter(Boolean)
          .join(" | ")
      )
      .join("\n");

  const formatMeds = (meds: TreatmentPlan["medications"]) =>
    meds
      .map(med =>
        [
          med.name,
          med.dose,
          med.frequency,
          med.duration,
          med.notes,
        ]
          .filter(Boolean)
          .join(" | ")
      )
      .join("\n");

  const parseLines = (text: string) =>
    text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  const parseSteps = (text: string): TreatmentPlan["steps"] => {
    return parseLines(text).map(line => {
      const [title, description, duration, frequency, notes] = line
        .split("|")
        .map(part => part.trim());
      if (!title || !description) {
        throw new Error("Cada passo precisa de Título e Descrição");
      }
      return { title, description, duration, frequency, notes };
    });
  };

  const parseMeds = (text: string): TreatmentPlan["medications"] => {
    return parseLines(text).map(line => {
      const [name, dose, frequency, duration, notes] = line
        .split("|")
        .map(part => part.trim());
      if (!name || !dose || !frequency) {
        throw new Error("Cada medicação precisa de Nome, Dose e Frequência");
      }
      return { name, dose, frequency, duration, notes };
    });
  };

  const handleExportTreatmentPlanPDF = () => {
    if (!consultation || !treatmentPlan) {
      toast.error("Plano de tratamento não disponível para exportação");
      return;
    }
    try {
      // Extract patient info from SOAP note if available
      const soapNote = consultation.soapNote as SOAPNote | null;
      const patientHistory = soapNote?.subjective?.historico_medico?.join(', ') || '';
      
      exportTreatmentPlanToPDF({
        patientName: consultation.patientName,
        createdAt: consultation.createdAt,
        treatmentPlan,
        dentistName: dentistProfile?.name,
        dentistCRO: dentistProfile?.croNumber,
        patientMedicalHistory: patientHistory || undefined,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
      console.error(error);
    }
  };

  const handleSaveTreatmentPlan = () => {
    if (!consultationId) return;
    try {
      const updatedPlan: TreatmentPlan = {
        summary: planForm.summary.trim() || undefined,
        steps: parseSteps(planForm.stepsText),
        medications: parseMeds(planForm.medsText),
        postOpInstructions: parseLines(planForm.postOpText),
        warnings: parseLines(planForm.warningsText),
      };
      updateTreatmentPlanMutation.mutate({
        consultationId,
        treatmentPlan: updatedPlan,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar plano");
    }
  };

  useEffect(() => {
    if (treatmentPlan) {
      setPlanForm({
        summary: treatmentPlan.summary || "",
        stepsText: formatSteps(treatmentPlan.steps || []),
        medsText: formatMeds(treatmentPlan.medications || []),
        postOpText: formatPlanLines(treatmentPlan.postOpInstructions || []),
        warningsText: formatPlanLines(treatmentPlan.warnings || []),
      });
    } else {
      setPlanForm({
        summary: "",
        stepsText: "",
        medsText: "",
        postOpText: "",
        warningsText: "",
      });
    }
  }, [treatmentPlan]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Consulta não encontrada</p>
            <Button onClick={() => setLocation("/consultations")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar às Consultas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const soapNote = consultation.soapNote as SOAPNote | null;

  return (
    <motion.div
      className="space-y-4 max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 lg:gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/consultations")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Consultas</span>
          </Button>
          <div>
            <h1 className="text-lg lg:text-xl font-bold">{consultation.patientName}</h1>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {new Date(consultation.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {soapNote && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span> PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar PDF da Nota SOAP</TooltipContent>
            </Tooltip>
          )}
          {treatmentPlan && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExportTreatmentPlanPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Plano</span> PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar PDF do Plano de Tratamento</TooltipContent>
            </Tooltip>
          )}
          
          {consultation.status !== "finalized" && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
          
          {consultation.status !== "finalized" && !isEditing && (
            <Button size="sm" onClick={handleFinalize} disabled={finalizeMutation.isPending}>
              {finalizeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Finalizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Finalizar
                </>
              )}
            </Button>
          )}

          {consultation.status === "finalized" && (
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
              <CheckCircle className="mr-1 h-3 w-3" />
              Finalizada
            </Badge>
          )}
          {consultation.status === "finalized" && (consultation as any).treatmentClosed === true && (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Tratamento Fechado
            </Badge>
          )}
          {consultation.status === "finalized" && (consultation as any).treatmentClosed === false && (
            <Badge className="bg-destructive/15 text-destructive border-destructive/20 gap-1">
              <XCircle className="h-3 w-3" />
              Não Fechado
            </Badge>
          )}
        </div>
      </div>

      <div>
        <Tabs defaultValue="soap" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="soap" className="text-xs sm:text-sm">
                <FileText className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nota</span> SOAP
              </TabsTrigger>
              <TabsTrigger value="odontogram" className="text-xs sm:text-sm">
                <svg viewBox="0 0 24 24" className="mr-1 sm:mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8 2 5 5 5 9c0 2 1 4 2 5l1 8h8l1-8c1-1 2-3 2-5 0-4-3-7-7-7z" />
                </svg>
                Odontograma
              </TabsTrigger>
              <TabsTrigger value="treatment-plan" className="text-xs sm:text-sm">
                <ClipboardList className="mr-1 sm:mr-2 h-4 w-4" />
                Plano
              </TabsTrigger>
              <TabsTrigger 
                value="neurovendas" 
                className="text-xs sm:text-sm relative"
                disabled={!canAccessNegotiation && !hasExistingNeurovendasData}
                onClick={(e) => {
                  if (!canAccessNegotiation && !hasExistingNeurovendasData) {
                    e.preventDefault();
                    setShowUpgradeModal(true);
                  }
                }}
              >
                <TrendingUp className="mr-1 sm:mr-2 h-4 w-4" />
                Negociação
                {!hasNegotiationAccess && !hasExistingNeurovendasData && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded-full">PRO</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-xs sm:text-sm">
                <AudioLines className="mr-1 sm:mr-2 h-4 w-4" />
                Transcrição
              </TabsTrigger>
            </TabsList>

            <TabsContent value="soap" className="space-y-6">
              {soapNote ? (
                <SOAPNoteViewer soapNote={soapNote} />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nota clínica ainda não foi gerada para esta consulta
                    </p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => setLocation(`/consultation/${consultationId}/review`)}
                    >
                      Ir para revisão de transcrição
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="odontogram" className="space-y-6">
              <Odontogram 
                affectedTeeth={soapNote?.objective?.dentes_afetados || []}
                diagnoses={soapNote?.assessment?.diagnosticos}
                teethData={soapNote?.objective?.classificacoes_dentes?.map((d: { numero: string; classificacao: string; notas?: string }) => ({
                  number: d.numero,
                  classification: d.classificacao as "not_evaluated" | "healthy" | "cavity" | "restored" | "missing" | "fractured" | "root_canal" | "crown" | "extraction",
                  notes: d.notas,
                }))}
              />
            </TabsContent>

            <TabsContent value="treatment-plan" className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Plano de Tratamento</h3>
                  <p className="text-xs text-muted-foreground">
                    Detalhamento clínico com sequência, medicações e cuidados
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {treatmentPlan && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingPlan(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => consultationId && generateTreatmentPlanMutation.mutate({ consultationId })}
                    disabled={generateTreatmentPlanMutation.isPending}
                  >
                    {generateTreatmentPlanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="mr-2 h-4 w-4" />
                        Gerar Plano
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {!treatmentPlan && (
                <Card>
                  <CardContent className="py-10 text-center">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Nenhum plano de tratamento disponível para esta consulta.
                    </p>
                    <Button
                      onClick={() => consultationId && generateTreatmentPlanMutation.mutate({ consultationId })}
                      disabled={generateTreatmentPlanMutation.isPending}
                    >
                      {generateTreatmentPlanMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        "Gerar Plano"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {treatmentPlan && (
                <div className="space-y-6">
                  {treatmentPlan.summary && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Resumo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{treatmentPlan.summary}</p>
                      </CardContent>
                    </Card>
                  )}

                  {treatmentPlan.steps.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          Sequência de Tratamento
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {treatmentPlan.steps.map((step, index) => (
                          <div key={index} className="border border-border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{step.title}</p>
                              <Badge variant="secondary" className="text-xs">
                                Etapa {index + 1}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{step.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                              {step.duration && <span>Duração: {step.duration}</span>}
                              {step.frequency && <span>Frequência: {step.frequency}</span>}
                              {step.notes && <span>Obs: {step.notes}</span>}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {treatmentPlan.medications.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          Medicações
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {treatmentPlan.medications.map((med, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm bg-muted/40 p-3 rounded-lg">
                            <Badge className="mt-0.5" variant="secondary">
                              {med.name}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium">{med.dose}</p>
                              <p className="text-xs text-muted-foreground">{med.frequency}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                {med.duration && <span>Duração: {med.duration}</span>}
                                {med.notes && <span>Obs: {med.notes}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {treatmentPlan.postOpInstructions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-primary" />
                          Instruções Pós-Operatórias
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {treatmentPlan.postOpInstructions.map((item, index) => (
                            <li key={index}>• {item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {treatmentPlan.warnings.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Alertas e Cuidados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {treatmentPlan.warnings.map((item, index) => (
                            <li key={index}>• {item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="transcript" className="space-y-4">
              {consultation.transcript ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AudioLines className="h-5 w-5 text-primary" />
                      Transcrição da Consulta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultation.audioUrl && (
                      <div className="mb-4">
                        <audio src={consultation.audioUrl} controls className="w-full" />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                      {consultation.transcript}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AudioLines className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Transcrição não disponível
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="neurovendas" className="space-y-6">
              <AdaptiveNegotiationTab 
                consultationId={consultationId!} 
                patientProfile={(consultation.soapNote as SOAPNote & { patientProfile?: PatientProfile })?.patientProfile}
                neurovendasAnalysis={consultation.neurovendasAnalysis as NeurovendasAnalysis | null}
                transcript={consultation.transcript}
                isActive={activeTab === "neurovendas"}
              />
            </TabsContent>
          </Tabs>
      </div>

      {/* Treatment Plan Editor */}
      <Dialog open={isEditingPlan} onOpenChange={setIsEditingPlan}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano de Tratamento</DialogTitle>
            <DialogDescription>
              Preencha cada item em uma linha. Use o formato com separadores "|".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resumo</Label>
              <Textarea
                value={planForm.summary}
                onChange={(e) => setPlanForm(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Resumo clínico do plano..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Sequência (Título | Descrição | Duração | Frequência | Observações)</Label>
              <Textarea
                value={planForm.stepsText}
                onChange={(e) => setPlanForm(prev => ({ ...prev, stepsText: e.target.value }))}
                placeholder="Ex.: Avaliação inicial | Revisar exames e sintomas | 1 consulta | Semanal | Priorizar dor"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Medicações (Nome | Dose | Frequência | Duração | Observações)</Label>
              <Textarea
                value={planForm.medsText}
                onChange={(e) => setPlanForm(prev => ({ ...prev, medsText: e.target.value }))}
                placeholder="Ex.: Paracetamol | 500mg | a cada 12h | 8 dias | após refeições"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Instruções Pós-Operatórias (uma por linha)</Label>
              <Textarea
                value={planForm.postOpText}
                onChange={(e) => setPlanForm(prev => ({ ...prev, postOpText: e.target.value }))}
                placeholder="Ex.: Repouso por 12 dias"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Alertas e Cuidados (uma por linha)</Label>
              <Textarea
                value={planForm.warningsText}
                onChange={(e) => setPlanForm(prev => ({ ...prev, warningsText: e.target.value }))}
                placeholder="Ex.: Retornar imediatamente em caso de febre"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditingPlan(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTreatmentPlan} disabled={updateTreatmentPlanMutation.isPending}>
              {updateTreatmentPlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Plano"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Consulta</DialogTitle>
            <DialogDescription>
              Avalie a consulta antes de finalizar. Seu feedback nos ajuda a melhorar o sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Star Rating */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Como você avalia a precisão do diagnóstico?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoveredStar || feedbackRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Treatment Closed */}
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-medium">Resultado do Tratamento</Label>
              <p className="text-xs text-muted-foreground">
                O paciente aceitou o plano de tratamento proposto?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTreatmentClosed(true)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    treatmentClosed === true
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                      : "border-border hover:border-emerald-500/50"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Fechado ✓</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTreatmentClosed(false)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    treatmentClosed === false
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border hover:border-destructive/50"
                  )}
                >
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Não Fechado</span>
                </button>
              </div>
              {treatmentClosed === false && (
                <Textarea
                  placeholder="Motivo (opcional): o que impediu o fechamento?"
                  value={treatmentClosedNotes}
                  onChange={(e) => setTreatmentClosedNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Comentário (opcional)</label>
              <Textarea
                placeholder="Deixe um comentário sobre a consulta..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button 
              className="w-full" 
              onClick={handleSubmitFeedback}
              disabled={feedbackRating === 0 || createFeedbackMutation.isPending}
            >
              {createFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Feedback e Finalizar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal for Basic users */}
      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        trigger="feature_gate"
        currentPlan={user?.subscriptionTier as "trial" | "basic" | "pro" | "unlimited" || "basic"}
        feature="Negociação"
      />
    </motion.div>
  );
}

// SOAP Note Viewer Component
function SOAPNoteViewer({ soapNote }: { soapNote: SOAPNote }) {
  return (
    <div className="space-y-6">
      {/* Red Flags */}
      {soapNote.assessment?.red_flags && soapNote.assessment.red_flags.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Sinais de Alerta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {soapNote.assessment.red_flags.map((flag: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span className="text-sm">{flag}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Subjective */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            Subjetivo (S)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {soapNote.subjective.queixa_principal && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Queixa Principal</h4>
              <p className="text-sm leading-relaxed">{soapNote.subjective.queixa_principal}</p>
            </div>
          )}
          
          {soapNote.subjective.historia_doenca_atual && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">História da Doença Atual</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {soapNote.subjective.historia_doenca_atual}
                </p>
              </div>
            </>
          )}
          
          {soapNote.subjective.historico_medico && soapNote.subjective.historico_medico.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Histórico Médico</h4>
                <ul className="text-sm space-y-1">
                  {soapNote.subjective.historico_medico.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Objective */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Objetivo (O)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {soapNote.objective.exame_clinico_geral && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Exame Clínico Geral</h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {soapNote.objective.exame_clinico_geral}
              </p>
            </div>
          )}
          
          {soapNote.objective.exame_clinico_especifico && soapNote.objective.exame_clinico_especifico.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Exame Clínico Específico</h4>
                <ul className="text-sm space-y-1">
                  {soapNote.objective.exame_clinico_especifico.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          
          {soapNote.objective.dentes_afetados && soapNote.objective.dentes_afetados.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Dentes Afetados</h4>
                <p className="text-sm">{soapNote.objective.dentes_afetados.join(", ")}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Assessment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Avaliação (A)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Diagnósticos</h4>
            <ul className="text-sm space-y-1">
              {soapNote.assessment.diagnosticos.map((diag, i) => (
                <li key={i}>• {diag}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Plano (P)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {soapNote.plan.tratamentos && soapNote.plan.tratamentos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Tratamentos Propostos</h4>
              <div className="space-y-3">
                {soapNote.plan.tratamentos.map((trat, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                    <Badge 
                      variant={trat.urgencia === 'alta' ? 'destructive' : trat.urgencia === 'media' ? 'default' : 'secondary'} 
                      className="mt-0.5 shrink-0"
                    >
                      {trat.urgencia}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">{trat.procedimento}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span>Dente: {trat.dente}</span>
                        {trat.prazo && <span>Prazo: {trat.prazo}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {soapNote.plan.orientacoes && soapNote.plan.orientacoes.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Orientações ao Paciente</h4>
                <ul className="text-sm space-y-1">
                  {soapNote.plan.orientacoes.map((or, i) => (
                    <li key={i}>• {or}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          
          {soapNote.plan.lembretes_clinicos && soapNote.plan.lembretes_clinicos.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Lembretes Clínicos</h4>
                <ul className="text-sm space-y-1">
                  {soapNote.plan.lembretes_clinicos.map((lem, i) => (
                    <li key={i}>• {lem}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
