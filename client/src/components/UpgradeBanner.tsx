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
    const tier = user.subscriptionTier;
    const priceId = subscriptionInfo?.priceId || user.priceId;
    
    // Check subscription tier first (most reliable)
    if (status === "active" || status === "trialing") {
      if (tier === "pro") return "pro";
      if (tier === "basic") return "basic";
      
      // Fallback to priceId matching (for legacy data)
      if (priceId) {
        // Current production IDs
        if (priceId.includes("price_1SuYhvJBQOFbtGZhu5hcAhqH")) return "pro";
        if (priceId.includes("price_1SuYhvJBQOFbtGZhL4AVyGqb")) return "basic";
        // Legacy IDs (if any)
        if (priceId.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) return "pro";
        if (priceId.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) return "basic";
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
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Plano Unlimited</p>
                <p className="text-sm text-muted-foreground">Acesso completo a todos os recursos</p>
              </div>
            </div>
            <Badge variant="secondary">Ativo</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pro users
  if (currentPlan === "pro") {
    return (
      <Card className={`bg-gradient-to-r from-primary/15 to-accent/10 border-primary/30 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Plano PRO Ativo</p>
                <p className="text-sm text-muted-foreground">Acesso completo com Neurovendas</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Ativo</Badge>
          </div>
          
          {showUsage && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultas usadas este mês</span>
                <span className="font-semibold">{consultationCount} / {limit}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors ${
                    isAtLimit ? "bg-destructive" : isNearLimit ? "bg-warning" : "bg-primary"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {remaining !== Infinity && (
                <p className="text-xs text-muted-foreground">
                  {remaining > 0 ? `${remaining} consultas restantes` : "Limite atingido"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Basic users
  if (currentPlan === "basic") {
    return (
      <Card className={`bg-gradient-to-r from-primary/15 to-accent/10 border-primary/30 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Plano Basic Ativo</p>
                <p className="text-sm text-muted-foreground">Plano essencial para dentistas</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Ativo</Badge>
          </div>
          
          {showUsage && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultas usadas este mês</span>
                <span className="font-semibold">{consultationCount} / {limit}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors ${
                    isAtLimit ? "bg-destructive" : isNearLimit ? "bg-warning" : "bg-primary"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {remaining !== Infinity && (
                <p className="text-xs text-muted-foreground">
                  {remaining > 0 ? `${remaining} consultas restantes` : "Limite atingido"}
                </p>
              )}
            </div>
          )}

          <motion.button
            onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Fazer Upgrade para PRO
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </CardContent>
      </Card>
    );
  }

  // Trial users
  if (currentPlan === "trial") {
    const daysLeft = user.trialEndsAt ? Math.ceil((new Date(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    return (
      <Card className={`bg-gradient-to-r from-accent/15 to-primary/10 border-accent/30 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-foreground">Trial Gratuito</p>
                <p className="text-sm text-muted-foreground">{daysLeft} dias restantes</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">Trial</Badge>
          </div>
          
          {showUsage && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultas usadas</span>
                <span className="font-semibold">{consultationCount} / 7</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (consultationCount / 7) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
              className="px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Basic
            </motion.button>
            <motion.button
              onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              PRO
            </motion.button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No plan - show upgrade options
  return (
    <Card className={`bg-gradient-to-r from-destructive/15 to-accent/10 border-destructive/30 ${className}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">Sem plano ativo</p>
              <p className="text-sm text-muted-foreground">Escolha um plano para continuar</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <motion.button
            onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.basic, user?.email), "_blank")}
            className="px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors flex items-center justify-center gap-1"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="h-4 w-4" />
            Basic
          </motion.button>
          <motion.button
            onClick={() => window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.pro, user?.email), "_blank")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            PRO
          </motion.button>
        </div>
      </CardContent>
    </Card>
  );
}
