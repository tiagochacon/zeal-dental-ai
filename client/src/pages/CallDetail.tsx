import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, Mic, FileText, Brain, CalendarCheck, PhoneOff, CheckCircle, ChevronRight, AlertTriangle, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function CallDetail() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const callId = parseInt(params.id || "0");
  const [schedulingResult, setSchedulingResult] = useState<string>("");
  const [schedulingNotes, setSchedulingNotes] = useState("");
  const [expandRapport, setExpandRapport] = useState(false);
  const [expandResumo, setExpandResumo] = useState(false);

  const callQuery = trpc.calls.getById.useQuery({ id: callId }, {
    enabled: !!user && callId > 0,
    refetchOnWindowFocus: false,
  });

  // Check negotiation access via billing API (respects clinic inheritance)
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const hasNegotiationAccess = planInfo?.hasNegotiationAccess ?? (user?.role === 'admin');

  const utils = trpc.useUtils();

  const transcribe = trpc.calls.transcribe.useMutation({
    onSuccess: () => {
      toast.success("Transcrição concluída!");
      utils.calls.getById.invalidate({ id: callId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const analyze = trpc.calls.analyzeNeurovendas.useMutation({
    onSuccess: () => {
      toast.success("Análise de Neurovendas concluída!");
      utils.calls.getById.invalidate({ id: callId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const finalize = trpc.calls.finalize.useMutation({
    onSuccess: () => {
      toast.success("Ligação finalizada!");
      utils.calls.getById.invalidate({ id: callId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!user || callQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const call = callQuery.data;
  if (!call) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Ligação não encontrada</h2>
          <Link href="/calls"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  const neurovendas = call.neurovendasAnalysis as any;

  // Step availability
  const step1Done = !!call.transcript;
  const step2Available = step1Done;
  const step2Done = !!neurovendas;
  const step3Available = step2Done;
  const step3Done = call.status === "finalized";

  // Rapport analysis
  const rapportNivel = neurovendas?.rapport?.nivel as number | undefined;
  const rapportJustificativa = neurovendas?.rapport?.justificativa as string | undefined;
  const resumoGeral = neurovendas?.resumoGeral as string | undefined;
  const hasLimitedAudio =
    neurovendas &&
    (rapportNivel === undefined || (resumoGeral && resumoGeral.length < 50) || (!resumoGeral));

  const rapportBarClass =
    rapportNivel !== undefined
      ? rapportNivel >= 70
        ? "[&>div]:bg-green-500"
        : rapportNivel >= 40
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-red-500"
      : "";

  const statusBadgeConfig: Record<string, { label: string; className: string }> = {
    analyzed: { label: "Analisada", className: "bg-green-600/20 text-green-400" },
    transcribed: { label: "Transcrita", className: "bg-blue-600/20 text-blue-400" },
    finalized: { label: "Finalizada", className: "bg-purple-600/20 text-purple-400" },
  };
  const statusBadge = statusBadgeConfig[call.status] ?? { label: "Pendente", className: "bg-gray-600/20 text-gray-400" };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/leads/${call.leadId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Lead
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ligação — {call.leadName}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Audio Player */}
        {call.audioUrl && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mic className="h-5 w-5 text-blue-400" />
              Áudio da Ligação
            </h2>
            <audio controls src={call.audioUrl} className="w-full" />
            {call.audioDurationSeconds && (
              <p className="text-xs text-muted-foreground mt-2">
                Duração: {Math.floor(call.audioDurationSeconds / 60)}min {call.audioDurationSeconds % 60}s
              </p>
            )}
          </div>
        )}

        {/* Pipeline Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-5">Pipeline de Processamento</h2>

          {/* Steps */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {/* Step 1 */}
            <div className={`flex-1 rounded-xl border p-4 transition-all ${
              step1Done
                ? "border-green-500/30 bg-green-600/10"
                : !call.audioUrl
                ? "opacity-50"
                : "border-border"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step1Done ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {step1Done ? <CheckCircle className="w-4 h-4" /> : "1"}
                </div>
                <span className="text-sm font-semibold text-foreground">Transcrever</span>
              </div>
              <Button
                onClick={() => transcribe.mutate({ callId })}
                disabled={!call.audioUrl || step1Done || transcribe.isPending}
                size="sm"
                className={`w-full ${step1Done ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30" : "bg-blue-600 hover:bg-blue-700"}`}
                variant={step1Done ? "outline" : "default"}
              >
                {transcribe.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : step1Done ? (
                  <CheckCircle className="h-4 w-4 mr-1" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                {step1Done ? "Concluído" : "Transcrever"}
              </Button>
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center text-muted-foreground self-center">
              <ChevronRight className="w-5 h-5" />
            </div>

            {/* Step 2 */}
            <div className={`flex-1 rounded-xl border p-4 transition-all ${
              step2Done
                ? "border-green-500/30 bg-green-600/10"
                : !step2Available
                ? "opacity-50"
                : "border-border"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step2Done ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {step2Done ? <CheckCircle className="w-4 h-4" /> : "2"}
                </div>
                <span className="text-sm font-semibold text-foreground">Analisar</span>
              </div>
              {!hasNegotiationAccess && !step2Done ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled
                      size="sm"
                      className="w-full opacity-60 cursor-not-allowed"
                      variant="outline"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Plano PRO
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Análise de Neurovendas disponível no plano PRO</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  onClick={() => analyze.mutate({ callId })}
                  disabled={!step2Available || step2Done || analyze.isPending}
                  size="sm"
                  className={`w-full ${step2Done ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30" : "bg-purple-600 hover:bg-purple-700"}`}
                  variant={step2Done ? "outline" : "default"}
                >
                  {analyze.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : step2Done ? (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  ) : (
                    <Brain className="h-4 w-4 mr-1" />
                  )}
                  {step2Done ? "Concluído" : "Neurovendas"}
                </Button>
              )}
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center text-muted-foreground self-center">
              <ChevronRight className="w-5 h-5" />
            </div>

            {/* Step 3 */}
            <div className={`flex-1 rounded-xl border p-4 transition-all ${
              step3Done
                ? "border-purple-500/30 bg-purple-600/10"
                : !step3Available
                ? "opacity-50"
                : "border-border"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step3Done ? "bg-purple-500 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {step3Done ? <CheckCircle className="w-4 h-4" /> : "3"}
                </div>
                <span className="text-sm font-semibold text-foreground">Finalizar</span>
              </div>
              <Button
                onClick={() => {
                  if (!schedulingResult) {
                    toast.error("Selecione o resultado do agendamento antes de finalizar");
                    return;
                  }
                  finalize.mutate({ callId, schedulingResult: schedulingResult as any, schedulingNotes });
                }}
                disabled={!step3Available || step3Done || finalize.isPending || (!step3Done && !schedulingResult)}
                size="sm"
                className={`w-full ${step3Done ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30" : "bg-amber-600 hover:bg-amber-700"}`}
                variant={step3Done ? "outline" : "default"}
              >
                {finalize.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : step3Done ? (
                  <CheckCircle className="h-4 w-4 mr-1" />
                ) : (
                  <CalendarCheck className="h-4 w-4 mr-1" />
                )}
                {step3Done ? "Finalizado" : "Finalizar"}
              </Button>
            </div>
          </div>

          {/* Scheduling Result — integrated inside pipeline, shown when step3 is available and not done */}
          {step3Available && !step3Done && (
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-3">
                Resultado do Agendamento <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div
                  onClick={() => setSchedulingResult("scheduled")}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    schedulingResult === "scheduled"
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-green-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-green-400" />
                    <span className="font-medium text-foreground">Agendado</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">O lead agendou uma consulta</p>
                </div>
                <div
                  onClick={() => setSchedulingResult("not_scheduled")}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    schedulingResult === "not_scheduled"
                      ? "border-red-500 bg-red-500/10"
                      : "border-border hover:border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PhoneOff className="h-5 w-5 text-red-400" />
                    <span className="font-medium text-foreground">Não Agendado</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">O lead não agendou desta vez</p>
                </div>
              </div>
              <textarea
                value={schedulingNotes}
                onChange={(e) => setSchedulingNotes(e.target.value)}
                placeholder="Observações sobre a ligação (opcional)..."
                className="w-full min-h-[80px] bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 py-3 text-sm resize-none"
              />
              {!schedulingResult && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione um resultado acima para habilitar o botão Finalizar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Finalized Result */}
        {step3Done && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Resultado</h2>
            <div className="flex items-center gap-3">
              {call.schedulingResult === "scheduled" ? (
                <>
                  <CalendarCheck className="h-6 w-6 text-green-400" />
                  <span className="text-green-400 font-semibold">Consulta Agendada</span>
                </>
              ) : (
                <>
                  <PhoneOff className="h-6 w-6 text-red-400" />
                  <span className="text-red-400 font-semibold">Não Agendado</span>
                </>
              )}
            </div>
            {call.schedulingNotes && (
              <p className="text-sm text-muted-foreground mt-3">{call.schedulingNotes}</p>
            )}
          </div>
        )}

        {/* Transcript */}
        {call.transcript && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" />
              Transcrição
            </h2>
            <div className="bg-secondary/50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap">{call.transcript}</p>
            </div>
          </div>
        )}

        {/* Neurovendas Analysis */}
        {neurovendas && hasNegotiationAccess && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              Análise de Neurovendas
            </h2>

            {/* Limited audio warning */}
            {hasLimitedAudio && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  Análise limitada — áudio curto detectado. Os resultados podem ser menos precisos.
                </p>
              </div>
            )}

            {/* Rapport */}
            {rapportNivel !== undefined && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">Rapport</span>
                  <span className={`text-sm font-bold ${
                    rapportNivel >= 70 ? "text-green-400" :
                    rapportNivel >= 40 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {rapportNivel}/100
                  </span>
                </div>
                <Progress
                  value={rapportNivel}
                  className={`h-2 ${rapportBarClass}`}
                />
                {rapportJustificativa && (
                  <div className="mt-2">
                    <p className={`text-sm text-muted-foreground ${!expandRapport ? "line-clamp-2" : ""}`}>
                      {rapportJustificativa}
                    </p>
                    {rapportJustificativa.length > 100 && (
                      <button
                        onClick={() => setExpandRapport(!expandRapport)}
                        className="text-xs text-primary mt-1 hover:underline"
                      >
                        {expandRapport ? "Ver menos" : "Ver mais"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Objeções */}
            {neurovendas.objecoes && neurovendas.objecoes.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-2">
                  Objeções Detectadas ({neurovendas.objecoes.length})
                </h3>
                <div className="space-y-3">
                  {neurovendas.objecoes.map((obj: any, i: number) => (
                    <div key={i} className="bg-secondary/50 rounded-lg p-4">
                      <p className="text-sm font-medium text-foreground mb-1">{obj.frase}</p>
                      <p className="text-xs text-muted-foreground mb-2">Contexto: {obj.contexto}</p>
                      {obj.tecnicaSugerida && (
                        <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-3 mt-2">
                          <p className="text-xs font-semibold text-green-400 mb-1">Resposta Sugerida:</p>
                          <p className="text-sm text-foreground">{obj.tecnicaSugerida}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo Geral */}
            {resumoGeral && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Resumo Geral</h3>
                <div className="border-l-4 border-primary pl-4 bg-primary/5 rounded-r-lg p-3">
                  <p className={`text-sm text-foreground ${!expandResumo ? "line-clamp-3" : ""}`}>
                    {resumoGeral}
                  </p>
                  {resumoGeral.length > 150 && (
                    <button
                      onClick={() => setExpandResumo(!expandResumo)}
                      className="text-xs text-primary mt-2 hover:underline"
                    >
                      {expandResumo ? "Recolher" : "Expandir"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
