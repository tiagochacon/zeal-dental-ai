import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { TrendingUp, AlertTriangle, Crown } from "lucide-react";

export function UsageIndicator() {
  const { user } = useAuth();

  if (!user || user.role === "admin") {
    return null;
  }

  // Calculate usage
  const consultationCount = user.consultationCount || 0;
  
  // Determine limit based on plan/trial
  let limit = 0;
  let planName = "Sem plano";
  
  // Check if in trial
  const hasActiveTrial = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  
  if (hasActiveTrial) {
    limit = 7; // Trial limit
    planName = "Trial";
  } else if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
    // Check price ID for plan
    if (user.priceId?.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) {
      limit = 20;
      planName = "Básico";
    } else if (user.priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
      limit = 50;
      planName = "Pro";
    }
  }

  // If no limit, user has no access
  if (limit === 0) {
    return (
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-yellow-500 mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Sem plano ativo</span>
        </div>
        <Link href="/pricing">
          <Button size="sm" className="w-full flex items-center justify-center gap-2">
            <Crown className="h-4 w-4 shrink-0" />
            <span>Ver Planos</span>
          </Button>
        </Link>
      </div>
    );
  }

  const usagePercent = Math.min((consultationCount / limit) * 100, 100);
  const remaining = Math.max(limit - consultationCount, 0);
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          Consultas ({planName})
        </span>
        <span className={`text-xs font-medium ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-muted-foreground'}`}>
          {consultationCount} / {limit}
        </span>
      </div>
      
      <Progress 
        value={usagePercent} 
        className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
      />
      
      {isAtLimit && (
        <div className="mt-2 flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs">Limite atingido</span>
        </div>
      )}
      
      {isNearLimit && !isAtLimit && (
        <div className="mt-2 flex items-center gap-2 text-yellow-500">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs">{remaining} restantes</span>
        </div>
      )}
      
      {(isNearLimit || planName === "Trial" || planName === "Básico") && (
        <Link href="/pricing">
          <Button 
            size="sm" 
            variant={isAtLimit ? "default" : "outline"} 
            className="w-full mt-3 flex items-center justify-center gap-2"
          >
            <Crown className="h-4 w-4 shrink-0" />
            <span>{isAtLimit ? "Fazer Upgrade" : "Ver Planos"}</span>
          </Button>
        </Link>
      )}
    </div>
  );
}
