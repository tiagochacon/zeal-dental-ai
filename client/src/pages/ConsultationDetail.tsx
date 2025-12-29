import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { exportSOAPToPDF } from "@/lib/pdfExport";
import Odontogram from "@/components/Odontogram";
import { 
  Loader2, ArrowLeft, FileText, AudioLines, Download, CheckCircle, Edit, 
  AlertTriangle, Stethoscope, ClipboardList, CheckCircle2, Star,
  LayoutDashboard, Users, Menu, X, LogOut
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import type { SOAPNote } from "../../../drizzle/schema";

export default function ConsultationDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const consultationId = params.id ? parseInt(params.id) : null;
  
  const { user, loading: authLoading, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: consultation, isLoading, refetch } = trpc.consultations.getById.useQuery(
    { id: consultationId! },
    { enabled: !!user && !!consultationId }
  );

  const { data: existingFeedback } = trpc.feedbacks.getByConsultation.useQuery(
    { consultationId: consultationId! },
    { enabled: !!user && !!consultationId }
  );

  const utils = trpc.useUtils();

  const updateSOAPMutation = trpc.consultations.updateSOAP.useMutation({
    onSuccess: () => {
      toast.success("Nota SOAP atualizada!");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar nota SOAP");
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
      }, {
        onSuccess: () => {
          finalizeMutation.mutate({ consultationId });
        },
      });
    }
  };

  const handleExportPDF = () => {
    if (!consultation || !consultation.soapNote) {
      toast.error("Nota SOAP não disponível para exportação");
      return;
    }
    try {
      exportSOAPToPDF({
        patientName: consultation.patientName,
        createdAt: consultation.createdAt,
        soapNote: consultation.soapNote as SOAPNote,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
      console.error(error);
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

  const soapNote = consultation.soapNote as SOAPNote | null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 border-r border-border bg-sidebar flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZEAL" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">Zeal</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-sidebar-accent rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => { setLocation("/"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/patients"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <Users className="h-5 w-5" />
                Pacientes
              </button>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="p-4 lg:p-6 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 lg:gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-muted rounded-lg"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Voltar</span>
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
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span> PDF
                </Button>
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
                <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Finalizada
                </Badge>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6 max-w-4xl mx-auto">
          <Tabs defaultValue="soap" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
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
          </Tabs>
        </div>
      </main>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avalie esta consulta</DialogTitle>
            <DialogDescription>
              Seu feedback é obrigatório para finalizar a consulta e nos ajuda a melhorar o sistema.
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
    </div>
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
