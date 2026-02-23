import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, ArrowLeft, Mic, FileText, Brain, CalendarCheck, PhoneOff,
  CheckCircle, TrendingUp, Lightbulb, AlertTriangle, Target, Sparkles,
  MessageCircle, Shield, ChevronRight, Volume2
} from "lucide-react";
import { useLocation, Link, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// Gauge visual de rapport (similar ao do dentista)
function RapportGauge({ value, maxValue = 10 }: { value: number; maxValue?: number }) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const color = value >= 7 ? "text-green-400" : value >= 4 ? "text-yellow-400" : "text-red-400";
  const bgColor = value >= 7 ? "bg-green-500" : value >= 4 ? "bg-yellow-500" : "bg-red-500";
  const label = value >= 7 ? "Excelente" : value >= 4 ? "Moderado" : "Baixo";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-700" />
          <circle
            cx="50" cy="50" r="42" fill="none" strokeWidth="8"
            className={bgColor.replace("bg-", "text-")}
            strokeDasharray={`${percentage * 2.64} ${264 - percentage * 2.64}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
          <span className="text-[10px] text-gray-400">/{maxValue}</span>
        </div>
      </div>
      <div className="text-center">
        <Badge variant="outline" className={`${color} border-current text-xs`}>
          {label}
        </Badge>
        <p className="text-[10px] text-gray-500 mt-1">Rapport</p>
      </div>
    </div>
  );
}

// Insight Card reutilizável
function InsightCard({ icon: Icon, title, content, color = "blue" }: {
  icon: any; title: string; content: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    green: "border-green-500/30 bg-green-500/10 text-green-400",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border ${colorMap[color] || colorMap.blue}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-gray-300 mb-1">{title}</p>
          <p className="text-sm text-gray-400 leading-relaxed">{content}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Objection Card
function ObjectionCard({ objection, index }: { objection: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-bold text-amber-400">{index + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">"{objection.frase}"</p>
            {objection.contexto && (
              <p className="text-xs text-muted-foreground mb-3">{objection.contexto}</p>
            )}
            {objection.tecnicaSugerida && (
              <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-xs font-semibold text-green-400">Resposta Sugerida</p>
                </div>
                <p className="text-sm text-gray-300">{objection.tecnicaSugerida}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CallDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const callId = parseInt(params.id || "0");
  const [schedulingResult, setSchedulingResult] = useState<string>("");
  const [schedulingNotes, setSchedulingNotes] = useState("");

  const callQuery = trpc.calls.getById.useQuery({ id: callId }, {
    enabled: !!user && callId > 0,
    refetchOnWindowFocus: false,
  });

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

  if (loading || callQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const call = callQuery.data;
  if (!call) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Ligação não encontrada</h2>
        <p className="text-muted-foreground mb-4">A ligação solicitada não existe ou foi removida.</p>
        <Link href="/crc">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const neurovendas = call.neurovendasAnalysis as any;
  const rapportLevel = neurovendas?.rapport?.nivel || 0;
  const objecoes = neurovendas?.objecoes || [];

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-gray-600/20 text-gray-400 border-gray-500/30" },
    transcribed: { label: "Transcrita", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
    analyzed: { label: "Analisada", className: "bg-green-600/20 text-green-400 border-green-500/30" },
    finalized: { label: "Finalizada", className: "bg-purple-600/20 text-purple-400 border-purple-500/30" },
  };

  const currentStatus = statusConfig[call.status] || statusConfig.pending;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/leads/${call.leadId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Lead
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Mic className="h-5 w-5 text-blue-400" />
              Ligação - {call.leadName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={currentStatus.className}>
                {currentStatus.label}
              </Badge>
              {call.audioDurationSeconds && (
                <span className="text-xs text-muted-foreground">
                  {Math.floor(call.audioDurationSeconds / 60)}min {call.audioDurationSeconds % 60}s
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      {call.audioUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Volume2 className="h-5 w-5 text-blue-400 shrink-0" />
              <span className="font-medium text-sm">Áudio da Ligação</span>
            </div>
            <audio controls src={call.audioUrl} className="w-full" />
          </CardContent>
        </Card>
      )}

      {/* Pipeline de Processamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Pipeline de Processamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => transcribe.mutate({ callId })}
              disabled={!call.audioUrl || !!call.transcript || transcribe.isPending}
              className={`flex-1 ${call.transcript ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30" : ""}`}
              variant={call.transcript ? "outline" : "default"}
            >
              {transcribe.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : call.transcript ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              1. Transcrever
            </Button>

            <ChevronRight className="h-4 w-4 text-muted-foreground self-center hidden sm:block" />

            <Button
              onClick={() => analyze.mutate({ callId })}
              disabled={!call.transcript || !!neurovendas || analyze.isPending}
              className={`flex-1 ${neurovendas ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30" : ""}`}
              variant={neurovendas ? "outline" : "default"}
            >
              {analyze.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : neurovendas ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              2. Analisar Neurovendas
            </Button>

            <ChevronRight className="h-4 w-4 text-muted-foreground self-center hidden sm:block" />

            <Button
              onClick={() => {
                if (!schedulingResult) {
                  toast.error("Selecione o resultado do agendamento");
                  return;
                }
                finalize.mutate({ callId, schedulingResult: schedulingResult as any, schedulingNotes });
              }}
              disabled={call.status === "finalized" || finalize.isPending}
              className={`flex-1 ${call.status === "finalized" ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30" : ""}`}
              variant={call.status === "finalized" ? "outline" : "default"}
            >
              {finalize.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : call.status === "finalized" ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <CalendarCheck className="h-4 w-4 mr-2" />
              )}
              3. Finalizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Result (para finalização) */}
      {call.status !== "finalized" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-amber-400" />
              Resultado do Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              className="w-full min-h-[80px] bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground px-4 py-3 text-sm resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* Resultado Finalizado */}
      {call.status === "finalized" && (
        <Card className={call.schedulingResult === "scheduled" ? "border-green-500/30" : "border-red-500/30"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {call.schedulingResult === "scheduled" ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CalendarCheck className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-400">Consulta Agendada</p>
                    {call.schedulingNotes && (
                      <p className="text-sm text-muted-foreground mt-0.5">{call.schedulingNotes}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <PhoneOff className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-400">Não Agendado</p>
                    {call.schedulingNotes && (
                      <p className="text-sm text-muted-foreground mt-0.5">{call.schedulingNotes}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Neurovendas Analysis - Design Rico */}
      {neurovendas && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Header da Análise com Gauge */}
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    <h2 className="text-lg font-bold text-foreground">Análise de Neurovendas</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Análise detalhada da ligação com o lead {call.leadName}
                  </p>

                  {/* Insight Cards de Rapport */}
                  {neurovendas.rapport && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {neurovendas.rapport.justificativa && (
                        <InsightCard
                          icon={TrendingUp}
                          title="Análise de Rapport"
                          content={neurovendas.rapport.justificativa}
                          color="green"
                        />
                      )}
                      {neurovendas.rapport.melhoria && (
                        <InsightCard
                          icon={Lightbulb}
                          title="Sugestão de Melhoria"
                          content={neurovendas.rapport.melhoria}
                          color="yellow"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Gauge de Rapport */}
                {neurovendas.rapport && (
                  <div className="shrink-0">
                    <RapportGauge value={rapportLevel} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Grid de conteúdo: 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Perfil e Gatilhos */}
            <div className="space-y-6">
              {/* Perfil Psicológico */}
              {neurovendas.perfilPsicologico && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-400" />
                        Perfil Psicológico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {neurovendas.perfilPsicologico.tipo && (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {neurovendas.perfilPsicologico.tipo}
                          </Badge>
                          {neurovendas.perfilPsicologico.confianca && (
                            <span className="text-xs text-muted-foreground">
                              {neurovendas.perfilPsicologico.confianca}% confiança
                            </span>
                          )}
                        </div>
                      )}
                      {neurovendas.perfilPsicologico.descricao && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {neurovendas.perfilPsicologico.descricao}
                        </p>
                      )}
                      {neurovendas.perfilPsicologico.abordagemRecomendada && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-400 mb-1">Abordagem Recomendada</p>
                          <p className="text-sm text-gray-300">{neurovendas.perfilPsicologico.abordagemRecomendada}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Gatilhos Mentais */}
              {neurovendas.gatilhosMentais && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        Gatilhos Mentais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {neurovendas.gatilhosMentais.positivos && neurovendas.gatilhosMentais.positivos.length > 0 && (
                        <div>
                          <span className="text-xs text-green-400 uppercase tracking-wide font-medium mb-2 block">
                            ✓ Use estes gatilhos
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {neurovendas.gatilhosMentais.positivos.map((g: string, i: number) => (
                              <Badge key={i} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                                {g}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {neurovendas.gatilhosMentais.negativos && neurovendas.gatilhosMentais.negativos.length > 0 && (
                        <div>
                          <span className="text-xs text-red-400 uppercase tracking-wide font-medium mb-2 block">
                            ✗ Evite estes gatilhos
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {neurovendas.gatilhosMentais.negativos.map((g: string, i: number) => (
                              <Badge key={i} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                                {g}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Palavras-chave Detectadas */}
              {neurovendas.palavrasChave && neurovendas.palavrasChave.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-cyan-400" />
                        Palavras-chave Detectadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {neurovendas.palavrasChave.map((kw: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm border border-cyan-500/20"
                          >
                            "{kw}"
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Coluna 2: Objeções e Script */}
            <div className="space-y-6">
              {/* Objeções Detectadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                        Objeções Detectadas
                      </CardTitle>
                      {objecoes.length > 0 && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {objecoes.length} encontrada{objecoes.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {objecoes.length > 0 ? (
                      <div className="space-y-3">
                        {objecoes.map((obj: any, i: number) => (
                          <ObjectionCard key={i} objection={obj} index={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma objeção detectada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Script PARE */}
              {neurovendas.scriptPARE && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-400" />
                        Script PARE
                        <span className="text-xs text-muted-foreground font-normal">(Problema-Agitação-Resolução-Emoção)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {neurovendas.scriptPARE.problema && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-red-400 mb-1">P — Problema</p>
                            <p className="text-sm text-gray-300">{neurovendas.scriptPARE.problema}</p>
                          </div>
                        )}
                        {neurovendas.scriptPARE.agitacao && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-400 mb-1">A — Agitação</p>
                            <p className="text-sm text-gray-300">{neurovendas.scriptPARE.agitacao}</p>
                          </div>
                        )}
                        {neurovendas.scriptPARE.resolucao && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-400 mb-1">R — Resolução</p>
                            <p className="text-sm text-gray-300">{neurovendas.scriptPARE.resolucao}</p>
                          </div>
                        )}
                        {neurovendas.scriptPARE.emocao && (
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-400 mb-1">E — Emoção</p>
                            <p className="text-sm text-gray-300">{neurovendas.scriptPARE.emocao}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>

          {/* Resumo Executivo */}
          {neurovendas.resumoGeral && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Resumo Executivo</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {neurovendas.resumoGeral}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Transcrição */}
      {call.transcript && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" />
              Transcrição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
