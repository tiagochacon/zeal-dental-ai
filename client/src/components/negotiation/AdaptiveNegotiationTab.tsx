import { motion } from 'framer-motion';
import { Shield, Brain, Heart, AlertTriangle, Lightbulb, Target, Sparkles, TrendingUp, MessageCircle, Loader2 } from 'lucide-react';
import { RapportGauge } from './RapportGauge';
import { NegotiationBadge } from './NegotiationBadge';
import { ObjectionMapper } from './ObjectionMapper';
import { ScriptPARE } from './ScriptPARE';
import { trpc } from '@/lib/trpc';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PatientProfile } from '../../../../drizzle/schema';
import type { NeurovendasAnalysis } from '../../../../drizzle/schema';

interface AdaptiveNegotiationTabProps {
  consultationId: number;
  patientProfile?: PatientProfile | null;
  neurovendasAnalysis?: NeurovendasAnalysis | null;
  transcript?: string | null;
  isActive?: boolean;
}

// Configurações visuais por perfil
const profileConfig = {
  reptilian: {
    name: 'Reptiliano',
    subtitle: 'Cérebro Primitivo - Sobrevivência',
    icon: Shield,
    color: 'green',
    bgGradient: 'from-green-950/50 to-gray-900',
    borderColor: 'border-green-500/30',
    accentColor: 'text-green-400',
    badgeVariant: 'comfort' as const,
    description: 'Este paciente opera principalmente pelo instinto de sobrevivência. Priorize segurança, controle e eliminação de medos.',
    keyApproach: [
      'Ambiente calmo e controlado',
      'Explicações simples e diretas',
      'Garantias de segurança',
      'Demonstrar controle total',
    ],
  },
  neocortex: {
    name: 'Neocórtex',
    subtitle: 'Cérebro Racional - Lógica',
    icon: Brain,
    color: 'blue',
    bgGradient: 'from-blue-950/50 to-gray-900',
    borderColor: 'border-blue-500/30',
    accentColor: 'text-blue-400',
    badgeVariant: 'data' as const,
    description: 'Este paciente é analítico e busca dados concretos. Apresente estatísticas, comparações e evidências científicas.',
    keyApproach: [
      'Dados e estatísticas de sucesso',
      'Comparação de opções',
      'Análise custo-benefício',
      'Referências científicas',
    ],
  },
  limbic: {
    name: 'Límbico',
    subtitle: 'Cérebro Emocional - Sentimentos',
    icon: Heart,
    color: 'purple',
    bgGradient: 'from-purple-950/50 to-gray-900',
    borderColor: 'border-purple-500/30',
    accentColor: 'text-purple-400',
    badgeVariant: 'emotion' as const,
    description: 'Este paciente é movido por emoções e aspirações. Foque na transformação, autoestima e impacto social.',
    keyApproach: [
      'Histórias de transformação',
      'Visualização do resultado',
      'Impacto na autoestima',
      'Conexão emocional',
    ],
  },
};

// Skeleton Loading Component
function NegotiationSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-900 rounded-xl border border-gray-700 overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-700" />
            <div>
              <div className="h-7 w-48 bg-gray-700 rounded mb-2" />
              <div className="h-4 w-32 bg-gray-700 rounded" />
            </div>
          </div>
          <div className="w-24 h-24 rounded-full bg-gray-700" />
        </div>
        <div className="mt-4 h-4 w-full bg-gray-700 rounded" />
        <div className="mt-2 h-4 w-3/4 bg-gray-700 rounded" />
      </div>
      
      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
            <div className="h-5 w-40 bg-gray-700 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-700 rounded" />
              <div className="h-4 w-5/6 bg-gray-700 rounded" />
              <div className="h-4 w-4/6 bg-gray-700 rounded" />
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
            <div className="h-5 w-36 bg-gray-700 rounded mb-4" />
            <div className="flex flex-wrap gap-2">
              <div className="h-8 w-24 bg-gray-700 rounded-full" />
              <div className="h-8 w-28 bg-gray-700 rounded-full" />
              <div className="h-8 w-20 bg-gray-700 rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
            <div className="h-5 w-44 bg-gray-700 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-16 w-full bg-gray-700 rounded" />
              <div className="h-16 w-full bg-gray-700 rounded" />
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
            <div className="h-5 w-32 bg-gray-700 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-20 w-full bg-gray-700 rounded" />
              <div className="h-20 w-full bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Loading indicator */}
      <div className="flex items-center justify-center py-4 border-t border-gray-700">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400 mr-2" />
        <span className="text-gray-400 text-sm">Gerando análise de Neurovendas...</span>
      </div>
    </div>
  );
}

export function AdaptiveNegotiationTab({ 
  consultationId, 
  patientProfile, 
  neurovendasAnalysis,
  transcript,
  isActive = false
}: AdaptiveNegotiationTabProps) {
  const hasTriggeredRef = useRef(false);
  const utils = trpc.useUtils();
  
  const generateNeurovendasMutation = trpc.neurovendas.analyzeConsultation.useMutation({
    onSuccess: (data) => {
      if (!data.cached) {
        toast.success('Análise de Neurovendas gerada com sucesso!');
      }
      utils.consultations.getById.invalidate({ id: consultationId });
    },
    onError: (error: { message: string }) => {
      toast.error(`Erro ao gerar análise: ${error.message}`);
    },
  });
  
  // Auto-trigger analysis when tab becomes active and transcript exists
  useEffect(() => {
    if (
      isActive && 
      transcript && 
      patientProfile && 
      !neurovendasAnalysis && 
      !hasTriggeredRef.current &&
      !generateNeurovendasMutation.isPending
    ) {
      hasTriggeredRef.current = true;
      generateNeurovendasMutation.mutate({ consultationId });
    }
  }, [isActive, transcript, patientProfile, neurovendasAnalysis, consultationId, generateNeurovendasMutation]);
  
  // Reset trigger flag when consultation changes
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [consultationId]);
  
  // Show skeleton while generating
  if (generateNeurovendasMutation.isPending) {
    return <NegotiationSkeleton />;
  }
  
  // Se não há perfil detectado, mostrar estado vazio
  if (!patientProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <Brain className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-300 mb-2">
          Perfil Neurológico Não Detectado
        </h3>
        <p className="text-gray-500 max-w-md mb-6">
          O perfil neurológico do paciente será detectado automaticamente quando a nota SOAP for gerada.
          {!transcript && ' Primeiro, grave ou transcreva a consulta.'}
        </p>
        {transcript && (
          <p className="text-sm text-gray-600">
            Gere a nota SOAP para detectar o perfil neurológico automaticamente.
          </p>
        )}
      </div>
    );
  }
  
  const config = profileConfig[patientProfile.type];
  const ProfileIcon = config.icon;
  
  // Preparar dados para os componentes
  const objections = neurovendasAnalysis?.objecoes?.verdadeiras?.map(obj => ({
    objection: obj.texto,
    response: obj.tecnicaSugerida,
    context: obj.categoria,
  })) || [];
  
  const scriptPARE = neurovendasAnalysis?.scriptPARE ? {
    problem: neurovendasAnalysis.scriptPARE.problema,
    agitation: neurovendasAnalysis.scriptPARE.amplificacao,
    resolution: neurovendasAnalysis.scriptPARE.resolucao,
    emotion: neurovendasAnalysis.scriptPARE.engajamento,
  } : null;
  
  // Usar valor persistido do neurovendasAnalysis, fallback para patientProfile
  const rapportLevel = neurovendasAnalysis?.rapport?.nivel ?? patientProfile.confidence ?? 50;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-gradient-to-br ${config.bgGradient} rounded-xl border ${config.borderColor} overflow-hidden`}
    >
      {/* Atribuição de Metodologia - Topo */}
      <div className="px-6 py-3 bg-gradient-to-r from-blue-950/30 to-transparent border-b border-blue-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-blue-300">
            Metodologia: <span className="text-blue-200">Dr. Carlos Rodriguez</span>
          </p>
        </div>
        <span className="text-xs text-gray-500">Análise Neurocientífica de Vendas</span>
      </div>
      
      {/* Header do Perfil */}
      <div className={`p-6 border-b ${config.borderColor}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className={`w-16 h-16 rounded-2xl bg-${config.color}-500/20 border ${config.borderColor} flex items-center justify-center`}
            >
              <ProfileIcon className={`w-8 h-8 ${config.accentColor}`} />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-2xl font-bold ${config.accentColor}`}>
                  Perfil {config.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-gray-700 text-xs text-gray-300">
                  {patientProfile.confidence}% confiança
                </span>
              </div>
              <p className="text-gray-400 text-sm">{config.subtitle}</p>
            </div>
          </div>
          
          {/* Gauge de Rapport */}
          <RapportGauge 
            value={rapportLevel} 
            label="Rapport" 
            color={config.color as 'green' | 'blue' | 'purple'} 
            size="md"
            breakdown={neurovendasAnalysis?.rapport?.breakdown}
            justificativa={neurovendasAnalysis?.rapport?.justificativa}
            melhoria={neurovendasAnalysis?.rapport?.melhoria}
            showInsights={false}
          />
        </div>
        
        {/* Descrição do perfil */}
        <p className="mt-4 text-gray-300 text-sm leading-relaxed">
          {config.description}
        </p>
        
        {/* Insight Cards de Rapport */}
        {neurovendasAnalysis?.rapport && (neurovendasAnalysis.rapport.justificativa || neurovendasAnalysis.rapport.melhoria) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {neurovendasAnalysis.rapport.justificativa && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`p-3 rounded-lg border ${config.borderColor} bg-${config.color}-500/10`}
              >
                <div className="flex items-start gap-2">
                  <TrendingUp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.accentColor}`} />
                  <div>
                    <p className="text-xs font-medium text-gray-300 mb-1">Análise Principal</p>
                    <p className="text-sm text-gray-400">{neurovendasAnalysis.rapport.justificativa}</p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {neurovendasAnalysis.rapport.melhoria && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                  <div>
                    <p className="text-xs font-medium text-gray-300 mb-1">Sugestão de Melhoria</p>
                    <p className="text-sm text-gray-400">{neurovendasAnalysis.rapport.melhoria}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
      
      {/* Grid de conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Coluna 1: Abordagem e Gatilhos */}
        <div className="space-y-6">
          {/* Abordagem Recomendada */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 rounded-lg p-5 border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className={`w-5 h-5 ${config.accentColor}`} />
              <h3 className="font-semibold text-gray-200">Abordagem Recomendada</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">{patientProfile.recommendedApproach}</p>
            <ul className="space-y-2">
              {config.keyApproach.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className={`w-1.5 h-1.5 rounded-full bg-${config.color}-500`} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          
          {/* Gatilhos Mentais */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-lg p-5 border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className={`w-5 h-5 ${config.accentColor}`} />
              <h3 className="font-semibold text-gray-200">Gatilhos Mentais</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-xs text-green-400 uppercase tracking-wide font-medium mb-2 block">
                  ✓ Use estes gatilhos
                </span>
                <div className="flex flex-wrap gap-2">
                  {patientProfile.triggers.positive.map((trigger, i) => (
                    <NegotiationBadge key={i} text={trigger} variant={config.badgeVariant} />
                  ))}
                </div>
              </div>
              
              <div>
                <span className="text-xs text-red-400 uppercase tracking-wide font-medium mb-2 block">
                  ✗ Evite estes gatilhos
                </span>
                <div className="flex flex-wrap gap-2">
                  {patientProfile.triggers.negative.map((trigger, i) => (
                    <NegotiationBadge key={i} text={trigger} variant="warning" />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Palavras-chave Detectadas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-lg p-5 border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className={`w-5 h-5 ${config.accentColor}`} />
              <h3 className="font-semibold text-gray-200">Palavras-chave Detectadas</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {patientProfile.detectedKeywords.map((keyword, i) => (
                <span 
                  key={i} 
                  className={`px-3 py-1 rounded-full bg-${config.color}-500/10 text-${config.color}-400 text-sm border border-${config.color}-500/20`}
                >
                  "{keyword}"
                </span>
              ))}
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2 block">
                Características Primárias
              </span>
              <ul className="space-y-1">
                {patientProfile.primaryTraits.map((trait: string, i: number) => (
                  <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full bg-${config.color}-500`} />
                    {trait}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
        
        {/* Coluna 2: Objeções e Script PARE */}
        <div className="space-y-6">
          {/* Mapeador de Objeções */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-lg p-5 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-gray-200">Objeções Detectadas</h3>
              </div>
              {objections.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                  {objections.length} encontrada{objections.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {neurovendasAnalysis ? (
              <ObjectionMapper objections={objections} />
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">
                  Aguardando análise de Neurovendas...
                </p>
              </div>
            )}
          </motion.div>
          
          {/* Script PARE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-lg p-5 border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className={`w-5 h-5 ${config.accentColor}`} />
              <h3 className="font-semibold text-gray-200">Script PARE</h3>
              <span className="text-xs text-gray-500">(Problema-Agitação-Resolução-Emoção)</span>
            </div>
            
            {scriptPARE ? (
              <ScriptPARE script={scriptPARE} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aguardando análise de Neurovendas...</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      
      {/* Footer com resumo executivo */}
      {neurovendasAnalysis?.resumoExecutivo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`p-6 border-t ${config.borderColor} bg-gray-900/50`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/20 flex items-center justify-center flex-shrink-0`}>
              <TrendingUp className={`w-5 h-5 ${config.accentColor}`} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-200 mb-1">Resumo Executivo</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                {neurovendasAnalysis.resumoExecutivo}
              </p>
            </div>
          </div>
        </motion.div>
      )}
      

    </motion.div>
  );
}
