import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles, Zap, ExternalLink } from "lucide-react";

// Stripe Payment Links
const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/test_4gM9AUaW8c0m94YbFk0Jq01",
  pro: "https://buy.stripe.com/test_4gMcN65BO6G22GAaBg0Jq00",
};

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

  const getUpgradeOptions = () => {
    switch (currentPlan) {
      case "trial":
        return [
          { name: "ZEAL Básico", price: "R$ 99,90/mês", limit: 20, link: PAYMENT_LINKS.basic, icon: Zap },
          { name: "ZEAL Pro", price: "R$ 199,90/mês", limit: 50, link: PAYMENT_LINKS.pro, icon: Sparkles, recommended: true },
        ];
      case "basic":
        return [
          { name: "ZEAL Pro", price: "R$ 199,90/mês", limit: 50, link: PAYMENT_LINKS.pro, icon: Sparkles, recommended: true },
        ];
      default:
        return [];
    }
  };

  const options = getUpgradeOptions();
  const limit = getPlanLimit();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="text-xl text-white">
              Limite de Consultas Atingido
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400">
            Você utilizou <span className="text-white font-semibold">{consultationsUsed}</span> de{" "}
            <span className="text-white font-semibold">{limit}</span> consultas disponíveis no seu plano{" "}
            <span className="capitalize">{currentPlan === "trial" ? "Trial" : currentPlan}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-gray-300">
            Para continuar usando a transcrição automática e geração de notas SOAP, faça upgrade para um plano com mais consultas:
          </p>

          <div className="space-y-3">
            {options.map((option) => (
              <div
                key={option.name}
                className={`p-4 rounded-lg border ${
                  option.recommended
                    ? "border-purple-500/50 bg-purple-500/10"
                    : "border-gray-700 bg-gray-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <option.icon
                      className={`h-5 w-5 ${
                        option.recommended ? "text-purple-400" : "text-blue-400"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white">{option.name}</p>
                      <p className="text-sm text-gray-400">
                        {option.limit} consultas/mês
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{option.price}</p>
                    {option.recommended && (
                      <span className="text-xs text-purple-400">Recomendado</span>
                    )}
                  </div>
                </div>
                <Button
                  className={`w-full mt-3 ${
                    option.recommended
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={() => window.open(option.link, "_blank")}
                >
                  Assinar {option.name}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ))}
          </div>

          {currentPlan === "pro" && (
            <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <p className="text-sm text-emerald-300">
                Você está no plano Pro. Seu limite será renovado no próximo ciclo de cobrança.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LimitReachedModal;
