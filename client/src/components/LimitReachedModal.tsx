import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Sparkles, 
  Zap, 
  ExternalLink, 
  Check, 
  Crown,
  TrendingUp,
  Brain,
  FileText,
  Mic
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

interface LimitReachedModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: "trial" | "basic" | "pro";
  consultationsUsed?: number;
}

export function LimitReachedModal({
  open,
  onClose,
  currentPlan = "trial",
  consultationsUsed = 0,
}: LimitReachedModalProps) {
  const { user } = useAuth();
  
  const getPlanLimit = () => {
    switch (currentPlan) {
      case "trial":
        return 7;
      case "basic":
        return 20;
      case "pro":
        return 50;
      default:
        return 7;
    }
  };

  const limit = getPlanLimit();
  const isTrialUser = currentPlan === "trial";
  const isBasicUser = currentPlan === "basic";

  // Features para cada plano - alinhados com permissões reais
  const basicFeatures = [
    { icon: Mic, text: "20 consultas/mês" },
    { icon: FileText, text: "Transcrição automática de áudio" },
    { icon: FileText, text: "Notas Clínicas com IA" },
    { icon: FileText, text: "Odontograma automático" },
    { icon: FileText, text: "Exportação de PDF" },
  ];

  const proFeatures = [
    { icon: Mic, text: "50 consultas/mês" },
    { icon: FileText, text: "Tudo do Básico +" },
    { icon: Brain, text: "Análise de Negociação/Neurovendas" },
    { icon: TrendingUp, text: "Perfil psicográfico do paciente" },
    { icon: Crown, text: "Script de fechamento PARE" },
    { icon: Crown, text: "Suporte prioritário" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isTrialUser ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90vh] bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 p-0 overflow-y-auto`}>
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 p-6 border-b border-slate-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <motion.div 
                className="p-3 rounded-full bg-amber-500/30"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </motion.div>
              <div>
                <DialogTitle className="text-xl text-white">
                  {isTrialUser ? "Seu Trial Gratuito Acabou!" : "Limite de Consultas Atingido"}
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Você utilizou <span className="text-white font-semibold">{consultationsUsed}</span> de{" "}
                  <span className="text-white font-semibold">{limit}</span> consultas
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">
          {/* Motivational message */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <p className="text-slate-300 text-sm">
              {isTrialUser 
                ? "Continue transformando suas consultas com a inteligência artificial do ZEAL. Escolha o plano ideal para você:" 
                : "Faça upgrade para o plano Pro e desbloqueie Análise de Negociação, Perfil Psicográfico e Script PARE:"}
            </p>
          </motion.div>

          {/* Plans Grid */}
          <AnimatePresence>
            <div className={`grid gap-4 ${isTrialUser ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* Basic Plan - Only show for trial users */}
              {isTrialUser && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/20">
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
                    {basicFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="h-4 w-4 text-blue-400 shrink-0" />
                        {feature.text}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
                  >
                    Assinar Básico
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* Pro Plan - Always show */}
              <motion.div
                initial={{ opacity: 0, x: isTrialUser ? 20 : 0 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="relative p-5 rounded-xl border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-indigo-500/10 hover:from-purple-500/15 hover:to-indigo-500/15 transition-all"
              >
                {/* Recommended badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-lg">
                    ⭐ MAIS POPULAR
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="p-2 rounded-lg bg-purple-500/20">
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
                  {proFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-purple-400 shrink-0" />
                      {feature.text}
                    </li>
                  ))}
                </ul>

                {/* Highlight for basic users */}
                {isBasicUser && (
                  <div className="mb-4 p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                    <p className="text-xs text-purple-300 text-center">
                      <Brain className="h-4 w-4 inline mr-1" />
                      Desbloqueie a <strong>Análise de Negociação/Neurovendas</strong> e aumente sua taxa de aceitação de tratamentos!
                    </p>
                  </div>
                )}

                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25"
                  onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Assinar Pro
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </div>
          </AnimatePresence>

          {/* Pro user message */}
          {currentPlan === "pro" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 mt-4"
            >
              <p className="text-sm text-emerald-300 text-center">
                ✨ Você está no plano Pro. Seu limite será renovado no próximo ciclo de cobrança.
              </p>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Cancele a qualquer momento
            </p>
            <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LimitReachedModal;
