import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

interface UsageCounterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "trial" | "basic" | "pro" | "unlimited" | "admin";
  consultationsUsed: number;
  consultationsLimit: number;
  daysRemaining?: number;
}

export function UsageCounterModal({
  open,
  onOpenChange,
  tier,
  consultationsUsed,
  consultationsLimit,
  daysRemaining,
}: UsageCounterModalProps) {
  const [, setLocation] = useLocation();
  const { startCheckout, checkoutPlan, isLoading } = useStripeCheckout();
  
  const percentage = Math.min(100, (consultationsUsed / consultationsLimit) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = consultationsUsed >= consultationsLimit;

  const tierConfig = {
    trial: {
      name: "Trial Gratuito",
      color: "emerald",
      icon: Zap,
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-500/10 to-teal-500/10",
      borderColor: "border-emerald-500/30",
    },
    basic: {
      name: "ZEAL Básico",
      color: "blue",
      icon: Crown,
      gradient: "from-blue-500 to-indigo-500",
      bgGradient: "from-blue-500/10 to-indigo-500/10",
      borderColor: "border-blue-500/30",
    },
    pro: {
      name: "ZEAL PRO",
      color: "purple",
      icon: Crown,
      gradient: "from-purple-500 to-indigo-500",
      bgGradient: "from-purple-500/10 to-indigo-500/10",
      borderColor: "border-purple-500/30",
    },
    unlimited: {
      name: "Acesso Ilimitado",
      color: "amber",
      icon: Crown,
      gradient: "from-amber-500 to-yellow-500",
      bgGradient: "from-amber-500/10 to-yellow-500/10",
      borderColor: "border-amber-500/30",
    },
    admin: {
      name: "Administrador",
      color: "amber",
      icon: Crown,
      gradient: "from-amber-500 to-yellow-500",
      bgGradient: "from-amber-500/10 to-yellow-500/10",
      borderColor: "border-amber-500/30",
    },
  };

  const config = tierConfig[tier] || tierConfig.trial;
  const IconComponent = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 p-0 overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.bgGradient} px-6 py-5 border-b border-slate-800`}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <motion.div 
                className={`p-2.5 rounded-full bg-gradient-to-r ${config.gradient}`}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <IconComponent className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <DialogTitle className="text-lg text-white">
                  {config.name}
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-sm">
                  Seu uso de consultas
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Usage Circle */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-slate-700"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - percentage / 100) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={isAtLimit ? "#ef4444" : isNearLimit ? "#f59e0b" : "#10b981"} />
                    <stop offset="100%" stopColor={isAtLimit ? "#dc2626" : isNearLimit ? "#d97706" : "#059669"} />
                  </linearGradient>
                </defs>
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-white'}`}>
                  {consultationsUsed}
                </span>
                <span className="text-slate-400 text-sm">
                  de {tier === 'unlimited' || tier === 'admin' ? '\u221E' : consultationsLimit}
                </span>
              </div>
            </div>

            {/* Status text */}
            <p className={`mt-4 text-sm font-medium ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isAtLimit 
                ? 'Limite atingido!' 
                : isNearLimit 
                  ? `${consultationsLimit - consultationsUsed} consultas restantes`
                  : `${consultationsLimit - consultationsUsed} consultas disponíveis`
              }
            </p>

            {/* Trial days remaining */}
            {tier === 'trial' && daysRemaining !== undefined && (
              <p className="mt-2 text-xs text-slate-400">
                {daysRemaining > 0 
                  ? `${daysRemaining} dias restantes no trial`
                  : 'Trial expirado'
                }
              </p>
            )}
          </div>

          {/* Upgrade CTA for non-pro users */}
          {tier !== 'pro' && tier !== 'unlimited' && tier !== 'admin' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span>
                    {tier === 'trial' 
                      ? 'Assine para continuar usando'
                      : 'Faça upgrade para mais consultas'
                    }
                  </span>
                </div>
              </div>

              {tier === 'trial' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={() => startCheckout("basic")}
                    disabled={isLoading}
                  >
                    {isLoading && checkoutPlan === "basic" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <span>Básico</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex items-center justify-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs"
                    onClick={() => startCheckout("pro")}
                    disabled={isLoading}
                  >
                    {isLoading && checkoutPlan === "pro" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Crown className="h-3 w-3 shrink-0" />
                        <span>PRO</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {tier === 'basic' && (
                <Button
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  onClick={() => startCheckout("pro")}
                  disabled={isLoading}
                >
                  {isLoading && checkoutPlan === "pro" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Crown className="h-4 w-4 shrink-0" />
                      <span>Upgrade para PRO</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Pro/Admin message */}
          {(tier === 'pro' || tier === 'unlimited' || tier === 'admin') && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} text-center`}>
                <Crown className={`h-6 w-6 mx-auto mb-2 ${tier === 'admin' ? 'text-amber-400' : 'text-purple-400'}`} />
                <p className="text-sm text-white font-medium">
                  {tier === 'admin' ? 'Acesso ilimitado como Admin' : 'Você está no plano mais completo!'}
                </p>
                {tier === 'pro' && (
                  <p className="text-xs text-slate-400 mt-1">
                    Limite renovado automaticamente todo mês
                  </p>
                )}
              </div>
              
              {/* Lista de recursos disponíveis */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-xs text-slate-400 mb-2 font-medium">Recursos disponíveis:</p>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    {tier === 'admin' || tier === 'unlimited' ? 'Consultas ilimitadas' : '50 consultas mensais'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Transcrição automática de áudio
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Notas Clínicas com IA
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Odontograma automático
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Exportação de PDF
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Análise de Negociação/Neurovendas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Perfil psicográfico do paciente
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Script de fechamento PARE
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    Suporte prioritário
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            className="w-full mt-4 text-slate-400 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UsageCounterModal;
