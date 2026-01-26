import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Loader2, Brain, Target, AlertCircle, Lightbulb, 
  MessageSquare, TrendingUp, Zap, Heart, Shield,
  Star, Sparkles, Users, ChevronRight
} from "lucide-react";
import type { NeurovendasAnalysis } from "../../../drizzle/schema";

interface NeurovendasTabProps {
  consultationId: number;
  hasTranscript: boolean;
}

export default function NeurovendasTab({ consultationId, hasTranscript }: NeurovendasTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: analysisData, isLoading, refetch } = trpc.neurovendas.getAnalysis.useQuery(
    { consultationId },
    { enabled: !!consultationId }
  );

  const analyzeMutation = trpc.neurovendas.analyzeConsultation.useMutation({
    onSuccess: () => {
      toast.success("Análise de Neurovendas gerada com sucesso!");
      refetch();
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar análise");
      setIsGenerating(false);
    },
  });

  const handleGenerateAnalysis = () => {
    if (!hasTranscript) {
      toast.error("Esta consulta não possui transcrição para análise");
      return;
    }
    setIsGenerating(true);
    analyzeMutation.mutate({ consultationId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analysisData?.hasAnalysis) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Brain className="h-16 w-16 text-blue-500/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Inteligência de Vendas Clínicas</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Analise a consulta com base na metodologia de Neurovendas do Dr. Carlos Rodriguez 
            para identificar o perfil do paciente, objeções ocultas e estratégias de fechamento.
          </p>
          <Button 
            onClick={handleGenerateAnalysis} 
            disabled={isGenerating || !hasTranscript}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Análise de Neurovendas
              </>
            )}
          </Button>
          {!hasTranscript && (
            <p className="text-xs text-muted-foreground mt-3">
              É necessário ter uma transcrição para gerar a análise
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const analysis = analysisData.analysis as NeurovendasAnalysis;

  return (
    <div className="space-y-6">
      {/* Header with Regenerate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Inteligência de Vendas
          </h3>
          <p className="text-sm text-muted-foreground">
            Metodologia Dr. Carlos Rodriguez
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleGenerateAnalysis}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerar
            </>
          )}
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed">{analysis.resumoExecutivo}</p>
        </CardContent>
      </Card>

      {/* Psychographic Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-purple-500" />
            Perfil Psicográfico do Paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Nível Cerebral Dominante</p>
              <Badge className={getBrainLevelColor(analysis.perfilPsicografico.nivelCerebralDominante)}>
                {getBrainLevelLabel(analysis.perfilPsicografico.nivelCerebralDominante)}
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Motivação Primária</p>
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                {getMotivationLabel(analysis.perfilPsicografico.motivacaoPrimaria)}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Nível de Ansiedade</p>
                <span className="text-sm font-medium">{analysis.perfilPsicografico.nivelAnsiedade}/10</span>
              </div>
              <Progress 
                value={analysis.perfilPsicografico.nivelAnsiedade * 10} 
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Receptividade</p>
                <span className="text-sm font-medium">{analysis.perfilPsicografico.nivelReceptividade}/10</span>
              </div>
              <Progress 
                value={analysis.perfilPsicografico.nivelReceptividade * 10} 
                className="h-2 [&>div]:bg-green-500"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            {analysis.perfilPsicografico.descricaoPerfil}
          </p>
        </CardContent>
      </Card>

      {/* Rapport Gauge */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5 text-red-500" />
            Termômetro de Rapport
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Nível de Conexão</span>
                <span className="text-lg font-bold">{analysis.rapport.nivel}/10</span>
              </div>
              <div className="relative h-4 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
                  style={{ left: `${(analysis.rapport.nivel / 10) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Frio</span>
                <span>Morno</span>
                <span>Quente</span>
              </div>
            </div>
          </div>

          {analysis.rapport.pontosFortesRelacionamento.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Pontos Fortes</p>
              <div className="flex flex-wrap gap-2">
                {analysis.rapport.pontosFortesRelacionamento.map((ponto, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-500">
                    {ponto}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.rapport.acoesParaMelhorar.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ações para Melhorar</p>
              <ul className="space-y-1">
                {analysis.rapport.acoesParaMelhorar.map((acao, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    {acao}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objections Mapper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Mapeador de Objeções
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.objecoes.verdadeiras.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Objeções Verdadeiras
              </p>
              <div className="space-y-2">
                {analysis.objecoes.verdadeiras.map((obj, i) => (
                  <div key={i} className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium">"{obj.texto}"</p>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {getObjectionCategoryLabel(obj.categoria)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-blue-500">Técnica sugerida:</span> {obj.tecnicaSugerida}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.objecoes.ocultas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Possíveis Objeções Ocultas
              </p>
              <div className="space-y-2">
                {analysis.objecoes.ocultas.map((obj, i) => (
                  <div key={i} className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">"{obj.texto}"</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <span className="font-medium">Sinais detectados:</span> {obj.sinaisDetectados}
                    </p>
                    <p className="text-xs bg-blue-500/10 p-2 rounded border border-blue-500/20">
                      <span className="font-medium text-blue-500">Pergunta reveladora:</span> "{obj.perguntaReveladora}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.objecoes.verdadeiras.length === 0 && analysis.objecoes.ocultas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma objeção significativa identificada na consulta
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mental Triggers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-yellow-500" />
            Gatilhos Mentais Recomendados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {analysis.gatilhosMentais.map((gatilho, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-4 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  {getTriggerIcon(gatilho.nome)}
                  <span className="font-semibold text-sm">{getTriggerLabel(gatilho.nome)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{gatilho.justificativa}</p>
                <div className="bg-background/50 p-2 rounded border">
                  <p className="text-xs text-muted-foreground">Exemplo de frase:</p>
                  <p className="text-sm italic">"{gatilho.exemploFrase}"</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PARE Script */}
      <Card className="border-green-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-green-500" />
            Script de Fechamento (Modelo PARE)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm">P</div>
                  <span className="font-semibold text-sm">Problema</span>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.scriptPARE.problema}</p>
              </div>
              
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>
                  <span className="font-semibold text-sm">Amplificação</span>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.scriptPARE.amplificacao}</p>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">R</div>
                  <span className="font-semibold text-sm">Resolução</span>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.scriptPARE.resolucao}</p>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">E</div>
                  <span className="font-semibold text-sm">Engajamento</span>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.scriptPARE.engajamento}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objection Technique */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            Técnica Recomendada para Objeções
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Badge className="bg-indigo-500">
              Técnica {analysis.tecnicaObjecao.tipo}
            </Badge>
          </div>
          <ol className="space-y-2">
            {analysis.tecnicaObjecao.passos.map((passo, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500 font-semibold text-xs shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm">{passo}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Language Signals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-cyan-500" />
            Sinais de Linguagem Detectados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.sinaisLinguagem.positivos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-500 mb-2">Sinais Positivos</p>
              <div className="flex flex-wrap gap-2">
                {analysis.sinaisLinguagem.positivos.map((sinal, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-500">
                    {sinal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.sinaisLinguagem.negativos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-2">Sinais de Resistência</p>
              <div className="flex flex-wrap gap-2">
                {analysis.sinaisLinguagem.negativos.map((sinal, i) => (
                  <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-500">
                    {sinal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.sinaisLinguagem.palavrasChaveEmocionais.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-500 mb-2">Palavras-Chave Emocionais</p>
              <div className="flex flex-wrap gap-2">
                {analysis.sinaisLinguagem.palavrasChaveEmocionais.map((palavra, i) => (
                  <Badge key={i} variant="outline" className="border-blue-500 text-blue-500">
                    "{palavra}"
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions
function getBrainLevelColor(level: string): string {
  switch (level) {
    case "neocortex": return "bg-blue-500";
    case "limbico": return "bg-purple-500";
    case "reptiliano": return "bg-red-500";
    default: return "bg-gray-500";
  }
}

function getBrainLevelLabel(level: string): string {
  switch (level) {
    case "neocortex": return "Neocórtex (Racional)";
    case "limbico": return "Límbico (Emocional)";
    case "reptiliano": return "Reptiliano (Instintivo)";
    default: return level;
  }
}

function getMotivationLabel(motivation: string): string {
  switch (motivation) {
    case "alivio_dor": return "Alívio da Dor";
    case "estetica": return "Estética";
    case "status": return "Status Social";
    case "saude": return "Saúde/Longevidade";
    default: return motivation;
  }
}

function getObjectionCategoryLabel(category: string): string {
  switch (category) {
    case "financeira": return "Financeira";
    case "medo": return "Medo";
    case "tempo": return "Tempo";
    case "confianca": return "Confiança";
    case "outra": return "Outra";
    default: return category;
  }
}

function getTriggerLabel(trigger: string): string {
  switch (trigger) {
    case "transformacao": return "Transformação";
    case "saude_longevidade": return "Saúde e Longevidade";
    case "status": return "Status Social";
    case "conforto": return "Conforto e Alívio";
    case "exclusividade": return "Exclusividade";
    default: return trigger;
  }
}

function getTriggerIcon(trigger: string) {
  switch (trigger) {
    case "transformacao": return <Sparkles className="h-4 w-4 text-yellow-500" />;
    case "saude_longevidade": return <Heart className="h-4 w-4 text-red-500" />;
    case "status": return <Star className="h-4 w-4 text-purple-500" />;
    case "conforto": return <Shield className="h-4 w-4 text-green-500" />;
    case "exclusividade": return <Zap className="h-4 w-4 text-blue-500" />;
    default: return <Lightbulb className="h-4 w-4 text-yellow-500" />;
  }
}
