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
  basic: "https://buy.stripe.com/7sYdRad130ICbUA7vmb7y03",
  pro: "https://buy.stripe.com/bJeaEY7GJ9f82k09Dub7y02",
};

// Helper to add email to Stripe payment link
function getPaymentLinkWithEmail(baseUrl: string, email?: string | null): string {
  if (!email) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('prefilled_email', email);
  return url.toString();
}

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
      <Card className={`bg-gradient-to-r from-primary/15 to-accent/10 border-primary/30 ${className}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {currentPlan === "admin" ? "Acesso Administrativo" : "ZEAL Unlimited"}
            </p>
            <p className="text-xs text-muted-foreground">Consultas ilimitadas</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-chart-5 ml-auto" />
        </CardContent>
      </Card>
    );
  }

  // Pro users - best plan
  if (currentPlan === "pro") {
    return (
      <Card className={`bg-gradient-to-r from-chart-5/15 to-chart-4/10 border-chart-5/30 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-5 w-5 text-chart-5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">ZEAL Pro</p>
              <p className="text-xs text-muted-foreground">Você está no melhor plano!</p>
            </div>
            <Badge variant="secondary" className="bg-chart-5/20 text-chart-5 border-chart-5/30">
              {remaining}/{limit} restantes
            </Badge>
          </div>
          {showUsage && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-chart-5 to-chart-4 rounded-full"
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
      <Card className={`bg-gradient-to-r from-primary/15 to-accent/10 border-primary/30 ${className}`}>
        <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">ZEAL Básico</p>
              <p className="text-xs text-muted-foreground">
                {isAtLimit 
                  ? "Limite atingido! Faça upgrade para continuar" 
                  : isNearLimit 
                    ? `Apenas ${remaining} consultas restantes`
                    : `${remaining}/${limit} consultas restantes`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Upgrade Pro
            </Button>
          </div>
          {showUsage && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isAtLimit 
                    ? "bg-destructive" 
                    : isNearLimit 
                      ? "bg-warning"
                      : "bg-gradient-to-r from-primary to-accent"
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
        ? "bg-gradient-to-r from-destructive/15 to-destructive/8 border-destructive/30"
        : isNearLimit
          ? "bg-gradient-to-r from-warning/15 to-warning/8 border-warning/30"
          : "bg-gradient-to-r from-warning/15 to-warning/8 border-warning/30"
    } ${className}`}>
      <CardContent className={variant === "compact" ? "p-3" : "p-4"}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isAtLimit ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isNearLimit ? (
              <AlertCircle className="h-5 w-5 text-warning" />
            ) : (
              <Zap className="h-5 w-5 text-warning" />
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
                isNearLimit ? "border-warning/50 text-warning" : "border-warning/50 text-warning"
              } text-xs`}>
                {remaining}/{limit} consultas
              </Badge>
            )}
          </div>
          
          {showUsage && currentPlan === "trial" && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isAtLimit 
                    ? "bg-destructive" 
                    : isNearLimit 
                      ? "bg-warning"
                      : "bg-gradient-to-r from-warning to-warning/70"
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
                  : "Assine para desbloquear transcrição e Notas Clínicas automáticas."
              }
            </p>
          )}
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-primary/50 text-primary hover:bg-primary/15"
              onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
            >
              Básico R$ 179,90
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Pro R$ 349,90
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UpgradeBanner;
