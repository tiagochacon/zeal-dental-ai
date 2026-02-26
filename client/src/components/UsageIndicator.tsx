import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { TrendingUp, AlertTriangle, Crown } from "lucide-react";

export function UsageIndicator() {
  const { user } = useAuth();

  // Always call the hook, but only enable when user is present and not admin
  const { data: planInfo, isLoading } = trpc.billing.getPlanInfo.useQuery(undefined, {
    enabled: !!user && user.role !== "admin",
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30s cache
  });

  if (!user || user.role === "admin") {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 py-3 border-t border-border">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  // No plan info available
  if (!planInfo) {
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

  const { tier, name: planName, used, limit, remaining, trialDaysRemaining } = planInfo;

  // Unlimited plan — no usage bar needed
  if (tier === "unlimited" || limit === null) {
    return (
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-emerald-400 mb-1">
          <Crown className="h-4 w-4" />
          <span className="text-sm font-medium">{planName}</span>
        </div>
        <span className="text-xs text-muted-foreground">Consultas ilimitadas</span>
      </div>
    );
  }

  // No active plan (trial expired, no subscription)
  const effectiveLimit = typeof limit === 'number' ? limit : 0;
  if (effectiveLimit === 0 && !planInfo.isTrialActive && tier === 'trial') {
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

  const usagePercent = effectiveLimit > 0 ? Math.min((used / effectiveLimit) * 100, 100) : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          Consultas ({planName})
        </span>
        <span className={`text-xs font-medium ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-muted-foreground'}`}>
          {used} / {effectiveLimit}
        </span>
      </div>
      
      <Progress 
        value={usagePercent} 
        className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
      />

      {/* Trial days remaining */}
      {tier === 'trial' && trialDaysRemaining !== undefined && trialDaysRemaining > 0 && (
        <div className="mt-1.5">
          <span className="text-xs text-muted-foreground">
            {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'} no trial
          </span>
        </div>
      )}
      
      {isAtLimit && (
        <div className="mt-2 flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs">Limite atingido</span>
        </div>
      )}
      
      {isNearLimit && !isAtLimit && (
        <div className="mt-2 flex items-center gap-2 text-yellow-500">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs">{remaining ?? 0} restantes</span>
        </div>
      )}
      
      {(isNearLimit || tier === "trial" || tier === "basic") && (
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
