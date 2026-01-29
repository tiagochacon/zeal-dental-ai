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
  Target,
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
  feature?: string; // Backward compatibility
}

// Copywriting persuasivo por trigger
const COPY_BY_TRIGGER = {
  trial_limit: {
    title: "Seu período de teste acabou!",
    subtitle: "Não pare sua evolução agora.",
    description: "Você experimentou o poder da IA no seu consultório. Agora é hora de desbloquear todo o potencial do ZEAL.",
    cta: "Sua produtividade não pode esperar. Faça o upgrade agora.",
    icon: Rocket,
    gradient: "from-amber-500/20 via-orange-500/20 to-red-500/20",
    iconBg: "bg-amber-500/30",
    iconColor: "text-amber-400",
  },
  basic_limit: {
    title: "Você atingiu o limite do seu plano!",
    subtitle: "Seu consultório está crescendo.",
    description: "20 consultas não são suficientes para acompanhar sua demanda. Libere a Inteligência em Neurovendas e feche mais tratamentos.",
    cta: "Desbloqueie o poder completo do ZEAL Pro.",
    icon: TrendingUp,
    gradient: "from-blue-500/20 via-indigo-500/20 to-purple-500/20",
    iconBg: "bg-blue-500/30",
    iconColor: "text-blue-400",
  },
  feature_gate: {
    title: "Recurso exclusivo do ZEAL Pro",
    subtitle: "Análise de Neurovendas bloqueada.",
    description: "A aba de Negociação utiliza inteligência artificial avançada para analisar o perfil psicográfico do paciente e aumentar sua taxa de fechamento.",
    cta: "Libere a Inteligência em Neurovendas e feche mais tratamentos.",
    icon: Lock,
    gradient: "from-purple-500/20 via-indigo-500/20 to-blue-500/20",
    iconBg: "bg-purple-500/30",
    iconColor: "text-purple-400",
  },
  pro_limit: {
    title: "Limite mensal atingido",
    subtitle: "Você está no plano mais completo.",
    description: "Seu limite de 50 consultas será renovado no próximo ciclo de cobrança. Continue aproveitando todos os recursos do ZEAL Pro.",
    cta: "Aguarde a renovação do seu ciclo.",
    icon: Crown,
    gradient: "from-emerald-500/20 via-teal-500/20 to-cyan-500/20",
    iconBg: "bg-emerald-500/30",
    iconColor: "text-emerald-400",
  },
};

// Features por plano
const PLAN_FEATURES = {
  basic: [
    { icon: Mic, text: "20 consultas/mês", highlight: false },
    { icon: FileText, text: "Transcrição automática com IA", highlight: false },
    { icon: FileText, text: "Notas SOAP inteligentes", highlight: false },
    { icon: Target, text: "Odontograma automático", highlight: false },
  ],
  pro: [
    { icon: Mic, text: "50 consultas/mês", highlight: true },
    { icon: FileText, text: "Transcrição automática com IA", highlight: false },
    { icon: FileText, text: "Notas SOAP inteligentes", highlight: false },
    { icon: Target, text: "Odontograma automático", highlight: false },
    { icon: Brain, text: "Análise de Neurovendas", highlight: true },
    { icon: TrendingUp, text: "Perfil psicográfico do paciente", highlight: true },
    { icon: Crown, text: "Script de fechamento PARE", highlight: true },
  ],
};

export function UpgradeModal({
  open,
  onOpenChange,
  trigger = "feature_gate",
  currentPlan = "trial",
  consultationsUsed = 0,
  consultationsLimit = 7,
  feature = "Negociação",
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
      <DialogContent className={`${showBasicPlan ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 p-0 overflow-hidden`}>
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${copy.gradient} p-6 border-b border-slate-800`}>
          <DialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <motion.div 
                className={`p-3 rounded-full ${copy.iconBg}`}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <IconComponent className={`h-6 w-6 ${copy.iconColor}`} />
              </motion.div>
              <div>
                <DialogTitle className="text-xl text-white">
                  {copy.title}
                </DialogTitle>
                <DialogDescription className="text-slate-300 mt-1 font-medium">
                  {copy.subtitle}
                </DialogDescription>
              </div>
            </div>
            
            {/* Usage indicator */}
            {trigger !== "feature_gate" && (
              <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Consultas utilizadas</span>
                  <span className="text-sm font-semibold text-white">
                    {consultationsUsed} / {consultationsLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <motion.div 
                    className={`h-2 rounded-full ${
                      consultationsUsed >= consultationsLimit 
                        ? 'bg-red-500' 
                        : consultationsUsed >= consultationsLimit * 0.8 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (consultationsUsed / consultationsLimit) * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </DialogHeader>
        </div>

        <div className="p-6">
          {/* Motivational message */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <p className="text-slate-300 text-sm mb-2">
              {copy.description}
            </p>
            <p className="text-white font-semibold text-base">
              {copy.cta}
            </p>
          </motion.div>

          {/* Plans Grid */}
          {!isProLimitReached && (
            <AnimatePresence>
              <div className={`grid gap-4 ${showBasicPlan ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Basic Plan - Only show for trial users */}
                {showBasicPlan && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                        <Zap className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">ZEAL Básico</h3>
                        <p className="text-2xl font-bold text-blue-400">
                          R$ 99,90<span className="text-sm font-normal text-slate-400">/mês</span>
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-5">
                      {PLAN_FEATURES.basic.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                          <Check className="h-4 w-4 text-blue-400 shrink-0" />
                          {feature.text}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all"
                      onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
                    >
                      Começar com Básico
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </motion.div>
                )}

                {/* Pro Plan */}
                {showProPlan && (
                  <motion.div
                    initial={{ opacity: 0, x: showBasicPlan ? 20 : 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative p-5 rounded-xl border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-indigo-500/10 hover:from-purple-500/15 hover:to-indigo-500/15 transition-all group"
                  >
                    {/* Recommended badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <motion.span 
                        className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-lg"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        ⭐ MAIS POPULAR
                      </motion.span>
                    </div>

                    <div className="flex items-center gap-3 mb-4 mt-2">
                      <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">ZEAL Pro</h3>
                        <p className="text-2xl font-bold text-purple-400">
                          R$ 199,90<span className="text-sm font-normal text-slate-400">/mês</span>
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-5">
                      {PLAN_FEATURES.pro.map((feat, index) => (
                        <li 
                          key={index} 
                          className={`flex items-center gap-2 text-sm ${
                            feat.highlight ? 'text-purple-300 font-medium' : 'text-slate-300'
                          }`}
                        >
                          <Check className={`h-4 w-4 shrink-0 ${
                            feat.highlight ? 'text-purple-400' : 'text-purple-400/70'
                          }`} />
                          {feat.text}
                          {feat.highlight && (
                            <span className="ml-auto text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                              PRO
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Feature gate highlight */}
                    {trigger === "feature_gate" && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-4 p-3 rounded-lg bg-purple-500/20 border border-purple-500/30"
                      >
                        <p className="text-xs text-purple-300 text-center">
                          <Brain className="h-4 w-4 inline mr-1" />
                          Desbloqueie a <strong>Análise de Neurovendas</strong> e aumente sua taxa de aceitação de tratamentos!
                        </p>
                      </motion.div>
                    )}

                    {/* Basic limit highlight */}
                    {trigger === "basic_limit" && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-4 p-3 rounded-lg bg-purple-500/20 border border-purple-500/30"
                      >
                        <p className="text-xs text-purple-300 text-center">
                          <TrendingUp className="h-4 w-4 inline mr-1" />
                          <strong>+150% de consultas</strong> e recursos avançados de Neurovendas
                        </p>
                      </motion.div>
                    )}

                    <Button
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-all"
                      onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Fazer Upgrade para Pro
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </AnimatePresence>
          )}

          {/* Pro user message */}
          {isProLimitReached && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10"
            >
              <div className="text-center">
                <Crown className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Você está no plano mais completo!
                </h3>
                <p className="text-sm text-emerald-300">
                  Seu limite de consultas será renovado automaticamente no próximo ciclo de cobrança.
                </p>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Cancele a qualquer momento • Sem fidelidade
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleNavigateToPricing} className="text-slate-400 hover:text-white text-sm">
                Ver todos os planos
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
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
