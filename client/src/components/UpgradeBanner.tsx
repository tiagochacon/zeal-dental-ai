import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Zap, 
  Crown, 
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// Stripe Payment Links
const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/test_4gM9AUaW8c0m94YbFk0Jq01",
  pro: "https://buy.stripe.com/test_4gMcN65BO6G22GAaBg0Jq00",
};

type UserPlan = "none" | "trial" | "basic" | "pro" | "unlimited" | "admin";

interface UpgradeBannerProps {
  variant?: "compact" | "full";
  className?: string;
  showUsage?: boolean;
}

export function UpgradeBanner({ variant = "full", className = "", showUsage = true }: UpgradeBannerProps) {
  const { user } = useAuth();
  const { data: subscriptionInfo } = trpc.stripe.getSubscriptionInfo.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) return null;

  // Determine current plan
  const getCurrentPlan = (): UserPlan => {
    if (user.role === "admin") return "admin";
    if (user.priceId === "unlimited" || user.subscriptionTier === "unlimited") return "unlimited";
    
    const status = subscriptionInfo?.subscriptionStatus || user.subscriptionStatus;
    const priceId = subscriptionInfo?.priceId || user.priceId;
    
    if (status === "active" || status === "trialing") {
      if (priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
        return "pro";
      }
      if (priceId?.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) {
        return "basic";
      }
    }
    
    // Check trial by dates
    if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (user.consultationCount || 0) < 7) {
      return "trial";
    }
    
    return "none";
  };

  const currentPlan = getCurrentPlan();

  // Calculate usage
  const consultationCount = user.consultationCount || 0;
  const getLimit = (): number => {
    switch (currentPlan) {
      case "admin":
      case "unlimited":
        return Infinity;
      case "pro":
        return 50;
      case "basic":
        return 20;
      case "trial":
        return 7;
      default:
        return 7;
    }
  };
  const limit = getLimit();
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - consultationCount);
  const usagePercent = limit === Infinity ? 0 : Math.min(100, (consultationCount / limit) * 100);
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  // Admin users - no banner needed
  if (currentPlan === "admin" || currentPlan === "unlimited") {
    return (
      <Card className={`bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-purple-500/30 ${className}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-white">
              {currentPlan === "admin" ? "Acesso Administrativo" : "ZEAL Unlimited"}
            </p>
            <p className="text-xs text-gray-400">Consultas ilimitadas</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-400 ml-auto" />
        </CardContent>
      </Card>
    );
  }

  // Pro users - best plan
  if (currentPlan === "pro") {
    return (
      <Card className={`bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-500/30 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">ZEAL Pro</p>
              <p className="text-xs text-gray-400">Você está no melhor plano!</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300">
              {remaining}/{limit} restantes
            </Badge>
          </div>
          {showUsage && (
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Basic users - show upgrade to Pro
  if (currentPlan === "basic") {
    return (
      <Card className={`bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border-blue-500/30 ${className}`}>
        <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">ZEAL Básico</p>
              <p className="text-xs text-gray-400">
                {isAtLimit 
                  ? "Limite atingido! Faça upgrade para continuar" 
                  : isNearLimit 
                    ? `Apenas ${remaining} consultas restantes`
                    : `${remaining}/${limit} consultas restantes`}
              </p>
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
          {showUsage && (
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isAtLimit 
                    ? "bg-gradient-to-r from-red-500 to-orange-500" 
                    : isNearLimit 
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-500"
                }`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Trial or no plan - show both options
  return (
    <Card className={`${
      isAtLimit 
        ? "bg-gradient-to-r from-red-900/50 to-orange-900/50 border-red-500/30"
        : isNearLimit
          ? "bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-amber-500/30"
          : "bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-amber-500/30"
    } ${className}`}>
      <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isAtLimit ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : isNearLimit ? (
              <AlertCircle className="h-5 w-5 text-amber-400" />
            ) : (
              <Zap className="h-5 w-5 text-amber-400" />
            )}
            <p className="text-sm font-medium text-white">
              {isAtLimit 
                ? "Limite de Trial Atingido!"
                : currentPlan === "trial" 
                  ? "Trial Gratuito" 
                  : "Escolha seu plano"}
            </p>
            {currentPlan === "trial" && !isAtLimit && (
              <Badge variant="outline" className={`${
                isNearLimit ? "border-amber-500/50 text-amber-300" : "border-amber-500/50 text-amber-300"
              } text-xs`}>
                {remaining}/{limit} consultas
              </Badge>
            )}
          </div>
          
          {showUsage && currentPlan === "trial" && (
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isAtLimit 
                    ? "bg-gradient-to-r from-red-500 to-orange-500" 
                    : isNearLimit 
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                      : "bg-gradient-to-r from-amber-500 to-orange-500"
                }`}
              />
            </div>
          )}
          
          {variant === "full" && (
            <p className="text-xs text-gray-400">
              {isAtLimit
                ? "Assine agora para continuar usando o ZEAL."
                : currentPlan === "trial" 
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
