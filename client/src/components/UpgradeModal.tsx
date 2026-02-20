import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Zap, 
  ExternalLink, 
  Check, 
  Crown,
  TrendingUp,
  Brain,
  FileText,
  Mic,
  Lock,
  Rocket,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// Stripe Payment Links
const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/9B6aEY8KNfDw9Ms3f6b7y00",
  pro: "https://buy.stripe.com/8x27sMd131MG4s8aHyb7y01",
};

// Helper to add email to Stripe payment link
function getPaymentLinkWithEmail(baseUrl: string, email?: string | null): string {
  if (!email) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('prefilled_email', email);
  return url.toString();
}

export type UpgradeModalTrigger = 
  | "trial_limit"      // Trial atingiu 7 consultas ou 7 dias
  | "basic_limit"      // Basic atingiu 20 consultas
  | "feature_gate"     // Tentativa de acesso à Negociação (basic)
  | "pro_limit";       // Pro atingiu 50 consultas

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: UpgradeModalTrigger;
  currentPlan?: "trial" | "basic" | "pro" | "unlimited";
  consultationsUsed?: number;
  consultationsLimit?: number;
  feature?: string;
}

// Copywriting persuasivo por trigger
const COPY_BY_TRIGGER = {
  trial_limit: {
    title: "Seu período de teste acabou!",
    subtitle: "Não pare sua evolução agora.",
    description: "Você experimentou o poder da IA no seu consultório. Agora é hora de desbloquear todo o potencial do ZEAL.",
    icon: Rocket,
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  basic_limit: {
    title: "Limite de consultas atingido!",
    subtitle: "Seu consultório está crescendo.",
    description: "Faça upgrade e desbloqueie mais consultas, Exportação de PDF e outros recursos.",
    icon: TrendingUp,
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconColor: "text-blue-400",
  },
  feature_gate: {
    title: "Recurso exclusivo PRO",
    subtitle: "Análise de Negociação bloqueada.",
    description: "Desbloqueie Análise de Negociação/Neurovendas, Perfil Psicográfico e Script PARE.",
    icon: Lock,
    gradient: "from-purple-500/20 to-indigo-500/20",
    iconColor: "text-purple-400",
  },
  pro_limit: {
    title: "Limite mensal atingido",
    subtitle: "Você está no plano mais completo.",
    description: "Seu limite será renovado no próximo ciclo de cobrança.",
    icon: Crown,
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
};

// Features organizados em grid 2 colunas - alinhados com permissões reais
const PLAN_FEATURES = {
  trial: {
    title: "Trial Gratuito",
    subtitle: "7 Dias",
    features: [
      "7 Consultas completas",
      "Transcrição automática de áudio",
      "Notas Clínicas com IA",
      "Odontograma automático",
      "Análise de Negociação",
    ],
  },
  basic: {
    title: "ZEAL Básico",
    price: "R$ 99,90",
    features: [
      "20 Consultas/mês",
      "Transcrição automática de áudio",
      "Notas Clínicas com IA",
      "Odontograma automático",
      "Exportação de PDF",
    ],
    footer: "Economize 2h por dia em documentação.",
  },
  pro: {
    title: "ZEAL PRO",
    price: "R$ 199,90",
    features: [
      "50 Consultas/mês",
      "Tudo do Básico +",
      "Análise de Negociação/Neurovendas",
      "Perfil psicográfico do paciente",
      "Script de fechamento PARE",
      "Suporte prioritário",
    ],
    footer: "Aumente sua taxa de fechamento em até 40%.",
  },
};

export function UpgradeModal({
  open,
  onOpenChange,
  trigger = "feature_gate",
  currentPlan = "trial",
  consultationsUsed = 0,
  consultationsLimit = 7,
}: UpgradeModalProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const copy = COPY_BY_TRIGGER[trigger];
  const IconComponent = copy.icon;
  
  const showBasicPlan = trigger === "trial_limit";
  const showProPlan = trigger !== "pro_limit";
  const isProLimitReached = trigger === "pro_limit";

  const handleNavigateToPricing = () => {
    onOpenChange(false);
    setLocation("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 p-0 overflow-hidden">
        {/* Compact Header */}
        <div className={`bg-gradient-to-r ${copy.gradient} px-5 py-4 border-b border-slate-800`}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-2 rounded-full bg-white/10"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <IconComponent className={`h-5 w-5 ${copy.iconColor}`} />
              </motion.div>
              <div>
                <DialogTitle className="text-lg text-white">
                  {copy.title}
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-sm">
                  {copy.subtitle}
                </DialogDescription>
              </div>
            </div>
            
            {/* Compact Usage Bar */}
            {trigger !== "feature_gate" && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <motion.div 
                    className={`h-1.5 rounded-full ${
                      consultationsUsed >= consultationsLimit ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (consultationsUsed / consultationsLimit) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {consultationsUsed}/{consultationsLimit}
                </span>
              </div>
            )}
          </DialogHeader>
        </div>

        {/* Content with scroll */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* Motivational message */}
          <p className="text-slate-300 text-sm text-center mb-4">
            {copy.description}
          </p>

          {/* Plans */}
          {!isProLimitReached && (
            <AnimatePresence>
              <div className={`grid gap-3 ${showBasicPlan ? 'grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Basic Plan Card */}
                {showBasicPlan && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-blue-300" />
                      <span className="font-bold text-blue-100 text-sm drop-shadow-sm">{PLAN_FEATURES.basic.title}</span>
                    </div>
                    <p className="text-xl font-bold text-blue-400 mb-3">
                      {PLAN_FEATURES.basic.price}<span className="text-xs text-slate-400">/mês</span>
                    </p>

                    {/* Features in 2 columns */}
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {PLAN_FEATURES.basic.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Check className="h-3 w-3 text-blue-400 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
                    >
                      Começar com Básico
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {/* Pro Plan Card */}
                {showProPlan && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative p-4 rounded-xl border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-indigo-500/10"
                  >
                    {/* Popular badge */}
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full">
                        ⭐ MAIS POPULAR
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <Sparkles className="h-4 w-4 text-purple-300" />
                      <span className="font-bold text-purple-100 text-sm drop-shadow-sm">{PLAN_FEATURES.pro.title}</span>
                    </div>
                    <p className="text-xl font-bold text-purple-400 mb-3">
                      {PLAN_FEATURES.pro.price}<span className="text-xs text-slate-400">/mês</span>
                    </p>

                    {/* Features */}
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {PLAN_FEATURES.pro.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Check className="h-3 w-3 text-purple-400 shrink-0" />
                          <span>{feat}</span>
                          {i >= 1 && i <= 3 && (
                            <span className="ml-auto text-[9px] bg-purple-500/30 text-purple-300 px-1 rounded">
                              PRO
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Feature gate highlight */}
                    {trigger === "feature_gate" && (
                      <div className="mb-3 p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                        <p className="text-[10px] text-purple-300 text-center">
                          <Brain className="h-3 w-3 inline mr-1" />
                          Desbloqueie <strong>Negociação/Neurovendas</strong> agora!
                        </p>
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs shadow-lg shadow-purple-500/25"
                      onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      Upgrade para Pro
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </AnimatePresence>
          )}

          {/* Pro user message */}
          {isProLimitReached && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
              <Crown className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">
                Você está no plano mais completo!
              </h3>
              <p className="text-xs text-emerald-300">
                Limite renovado automaticamente no próximo ciclo.
              </p>
            </div>
          )}

          {/* Compact Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
            <p className="text-[10px] text-slate-500">
              Cancele a qualquer momento
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleNavigateToPricing} className="text-slate-400 hover:text-white text-xs h-7 px-2">
                Ver planos
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white text-xs h-7 px-2">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
