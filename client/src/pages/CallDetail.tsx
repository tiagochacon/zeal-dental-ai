import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Mic, FileText, Brain, CalendarCheck, PhoneOff, CheckCircle } from "lucide-react";
import { useLocation, Link, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const call = callQuery.data;
  if (!call) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Ligação não encontrada</h2>
          <Link href="/"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  const neurovendas = call.neurovendasAnalysis as any;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Link href={`/leads/${call.leadId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Lead
              </Button>
            </Link>
            <h1 className="text-lg font-bold text-foreground">Ligação - {call.leadName}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              call.status === "analyzed" ? "bg-green-600/20 text-green-400" :
              call.status === "transcribed" ? "bg-blue-600/20 text-blue-400" :
              call.status === "finalized" ? "bg-purple-600/20 text-purple-400" :
              "bg-gray-600/20 text-gray-400"
            }`}>
              {call.status === "analyzed" ? "Analisada" :
               call.status === "transcribed" ? "Transcrita" :
               call.status === "finalized" ? "Finalizada" : "Pendente"}
            </span>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-4xl mx-auto space-y-6">
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

        {/* Action Pipeline */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Pipeline de Processamento</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Step 1: Transcribe */}
            <Button
              onClick={() => transcribe.mutate({ callId })}
              disabled={!call.audioUrl || !!call.transcript || transcribe.isPending}
              className={`flex-1 ${call.transcript ? "bg-green-600/20 text-green-400 border border-green-500/30" : "bg-blue-600 hover:bg-blue-700"}`}
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

            {/* Step 2: Analyze */}
            <Button
              onClick={() => analyze.mutate({ callId })}
              disabled={!call.transcript || !!neurovendas || analyze.isPending}
              className={`flex-1 ${neurovendas ? "bg-green-600/20 text-green-400 border border-green-500/30" : "bg-purple-600 hover:bg-purple-700"}`}
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

            {/* Step 3: Finalize */}
            <Button
              onClick={() => {
                if (!schedulingResult) {
                  toast.error("Selecione o resultado do agendamento");
                  return;
                }
                finalize.mutate({ callId, schedulingResult: schedulingResult as any, schedulingNotes });
              }}
              disabled={call.status === "finalized" || finalize.isPending}
              className={`flex-1 ${call.status === "finalized" ? "bg-green-600/20 text-green-400 border border-green-500/30" : "bg-amber-600 hover:bg-amber-700"}`}
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
        </div>

        {/* Scheduling Result (for finalization) */}
        {call.status !== "finalized" && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Resultado do Agendamento</h2>
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
          </div>
        )}

        {/* Finalized Result */}
        {call.status === "finalized" && (
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
        {neurovendas && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              Análise de Neurovendas
            </h2>

            {/* Rapport */}
            {neurovendas.rapport && (
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-2">Rapport</h3>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-muted-foreground">Nível:</span>
                  <span className={`text-sm font-semibold ${
                    neurovendas.rapport.nivel >= 7 ? "text-green-400" :
                    neurovendas.rapport.nivel >= 4 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {neurovendas.rapport.nivel}/10
                  </span>
                </div>
                {neurovendas.rapport.justificativa && (
                  <p className="text-sm text-muted-foreground">{neurovendas.rapport.justificativa}</p>
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

            {/* Resumo */}
            {neurovendas.resumoGeral && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Resumo Geral</h3>
                <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-4">{neurovendas.resumoGeral}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
