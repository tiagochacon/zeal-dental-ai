import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Info, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RapportBreakdown {
  validacaoEmocional: number;
  espelhamentoLinguistico: number;
  escutaAtiva: number;
  equilibrioTurnos: number;
  ausenciaInterrupcoes: number;
}

interface RapportGaugeProps {
  value: number;
  label: string;
  color: 'green' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  breakdown?: RapportBreakdown;
  justificativa?: string;
  melhoria?: string;
  showInsights?: boolean;
}

const breakdownLabels: Record<keyof RapportBreakdown, { label: string; max: number; icon: string }> = {
  validacaoEmocional: { label: 'Validação Emocional', max: 30, icon: '💚' },
  espelhamentoLinguistico: { label: 'Espelhamento Linguístico', max: 25, icon: '🪞' },
  escutaAtiva: { label: 'Escuta Ativa', max: 20, icon: '👂' },
  equilibrioTurnos: { label: 'Equilíbrio de Turnos', max: 15, icon: '⚖️' },
  ausenciaInterrupcoes: { label: 'Ausência de Interrupções', max: 10, icon: '🤫' },
};

function BreakdownBar({ 
  label, 
  value, 
  max, 
  icon,
  color 
}: { 
  label: string; 
  value: number; 
  max: number; 
  icon: string;
  color: 'green' | 'blue' | 'purple';
}) {
  const percentage = (value / max) * 100;
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="flex items-center gap-1">
          <span>{icon}</span>
          <span className="text-gray-300">{label}</span>
        </span>
        <span className="text-gray-400 font-mono">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

export function RapportGauge({ 
  value, 
  label, 
  color, 
  size = 'md',
  breakdown,
  justificativa,
  melhoria,
  showInsights = true
}: RapportGaugeProps) {
  const colorClasses = {
    green: {
      stroke: 'stroke-green-500',
      text: 'text-green-500',
      bg: 'text-green-500/20',
      border: 'border-green-500/30',
      bgCard: 'bg-green-500/10',
    },
    blue: {
      stroke: 'stroke-blue-500',
      text: 'text-blue-500',
      bg: 'text-blue-500/20',
      border: 'border-blue-500/30',
      bgCard: 'bg-blue-500/10',
    },
    purple: {
      stroke: 'stroke-purple-500',
      text: 'text-purple-500',
      bg: 'text-purple-500/20',
      border: 'border-purple-500/30',
      bgCard: 'bg-purple-500/10',
    },
  };
  
  const sizeClasses = {
    sm: { container: 'w-20 h-20', text: 'text-lg', label: 'text-xs' },
    md: { container: 'w-32 h-32', text: 'text-2xl', label: 'text-sm' },
    lg: { container: 'w-40 h-40', text: 'text-3xl', label: 'text-base' },
  };
  
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  // Determine rapport level
  const getRapportLevel = (val: number) => {
    if (val >= 80) return { level: 'Excelente', icon: TrendingUp, color: 'text-green-400' };
    if (val >= 60) return { level: 'Bom', icon: TrendingUp, color: 'text-blue-400' };
    if (val >= 40) return { level: 'Regular', icon: AlertCircle, color: 'text-yellow-400' };
    return { level: 'Precisa Melhorar', icon: AlertCircle, color: 'text-red-400' };
  };
  
  const rapportLevel = getRapportLevel(value);
  
  return (
    <div className="flex flex-col items-center gap-4">
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className={cn('relative cursor-help', sizeClasses[size].container)}>
              <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={colorClasses[color].bg}
                />
                {/* Progress circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={colorClasses[color].stroke}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{
                    strokeDasharray: circumference,
                  }}
                />
              </svg>
              {/* Center value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className={cn('font-bold', sizeClasses[size].text, colorClasses[color].text)}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  {value}%
                </motion.span>
                {breakdown && (
                  <Info className="w-3 h-3 text-gray-500 mt-1" />
                )}
              </div>
            </div>
          </TooltipTrigger>
          {breakdown && (
            <TooltipContent 
              side="right" 
              className="w-72 p-4 bg-gray-900 border-gray-700"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                  <span className="font-semibold text-white">Breakdown do Rapport</span>
                  <span className={cn('text-sm font-medium', rapportLevel.color)}>
                    {rapportLevel.level}
                  </span>
                </div>
                {Object.entries(breakdown).map(([key, val]) => {
                  const config = breakdownLabels[key as keyof RapportBreakdown];
                  return (
                    <BreakdownBar
                      key={key}
                      label={config.label}
                      value={val}
                      max={config.max}
                      icon={config.icon}
                      color={color}
                    />
                  );
                })}
                <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
                  Total: {Object.values(breakdown).reduce((a, b) => a + b, 0)}/100 pontos
                </div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      
      <span className={cn('font-medium text-gray-400', sizeClasses[size].label)}>{label}</span>
      
      {/* Insight Cards */}
      {showInsights && (justificativa || melhoria) && (
        <div className="w-full max-w-sm space-y-2 mt-2">
          {justificativa && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className={cn(
                'p-3 rounded-lg border',
                colorClasses[color].border,
                colorClasses[color].bgCard
              )}
            >
              <div className="flex items-start gap-2">
                <TrendingUp className={cn('w-4 h-4 mt-0.5 flex-shrink-0', colorClasses[color].text)} />
                <div>
                  <p className="text-xs font-medium text-gray-300 mb-1">Análise Principal</p>
                  <p className="text-sm text-gray-400">{justificativa}</p>
                </div>
              </div>
            </motion.div>
          )}
          
          {melhoria && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
            >
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                <div>
                  <p className="text-xs font-medium text-gray-300 mb-1">Sugestão de Melhoria</p>
                  <p className="text-sm text-gray-400">{melhoria}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
