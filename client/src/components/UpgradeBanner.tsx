import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Crown, ExternalLink } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// Stripe Payment Links
const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/test_4gM9AUaW8c0m94YbFk0Jq01",
  pro: "https://buy.stripe.com/test_4gMcN65BO6G22GAaBg0Jq00",
};

type UserPlan = "none" | "trial" | "basic" | "pro" | "admin";

interface UpgradeBannerProps {
  variant?: "compact" | "full";
  className?: string;
}

export function UpgradeBanner({ variant = "full", className = "" }: UpgradeBannerProps) {
  const { user } = useAuth();
  const { data: subscriptionInfo } = trpc.stripe.getSubscriptionInfo.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) return null;

  // Determine current plan
  const getCurrentPlan = (): UserPlan => {
    if (user.role === "admin") return "admin";
    
    const status = subscriptionInfo?.subscriptionStatus;
    const priceId = subscriptionInfo?.priceId;
    
    if (status === "active" || status === "trialing") {
      if (priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
        return "pro";
      }
      if (priceId?.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) {
        return "basic";
      }
    }
    
    // Check trial by dates
    if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
      return "trial";
    }
    
    return "none";
  };

  const currentPlan = getCurrentPlan();

  // Admin users - no banner needed
  if (currentPlan === "admin") {
    return (
      <Card className={`bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-purple-500/30 ${className}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-white">Acesso Ilimitado</p>
            <p className="text-xs text-gray-400">Conta administrativa</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pro users - best plan
  if (currentPlan === "pro") {
    return (
      <Card className={`bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-500/30 ${className}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-white">ZEAL Pro</p>
            <p className="text-xs text-gray-400">Você está no melhor plano!</p>
          </div>
          <Badge variant="secondary" className="ml-auto bg-emerald-500/20 text-emerald-300">
            50 consultas/mês
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Basic users - show upgrade to Pro
  if (currentPlan === "basic") {
    return (
      <Card className={`bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border-blue-500/30 ${className}`}>
        <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">ZEAL Básico</p>
              <p className="text-xs text-gray-400">Upgrade para 50 consultas/mês</p>
            </div>
            <Button
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              onClick={() => window.open(PAYMENT_LINKS.pro, "_blank")}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Upgrade Pro
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Trial or no plan - show both options
  return (
    <Card className={`bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-amber-500/30 ${className}`}>
      <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <p className="text-sm font-medium text-white">
              {currentPlan === "trial" ? "Trial Gratuito" : "Escolha seu plano"}
            </p>
            {currentPlan === "trial" && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-300 text-xs">
                7 consultas
              </Badge>
            )}
          </div>
          
          {variant === "full" && (
            <p className="text-xs text-gray-400">
              {currentPlan === "trial" 
                ? "Seu trial expira em breve. Assine para continuar usando."
                : "Assine para desbloquear transcrição e notas SOAP automáticas."
              }
            </p>
          )}
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
              onClick={() => window.open(PAYMENT_LINKS.basic, "_blank")}
            >
              Básico R$ 99,90
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              onClick={() => window.open(PAYMENT_LINKS.pro, "_blank")}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Pro R$ 199,90
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UpgradeBanner;
