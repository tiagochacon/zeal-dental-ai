import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import type { UpgradeModalTrigger } from "@/components/UpgradeModal";

interface UsageLimitInfo {
  // Current plan info
  currentPlan: "trial" | "basic" | "pro" | "unlimited";
  consultationsUsed: number;
  consultationsLimit: number;
  
  // Status flags
  isLimitReached: boolean;
  isTrialExpired: boolean;
  hasNegotiationAccess: boolean;
  
  // Trigger for modal
  trigger: UpgradeModalTrigger | null;
  
  // Percentage used
  usagePercentage: number;
  
  // Helper functions
  shouldShowUpgradeModal: () => boolean;
  getUpgradeTrigger: () => UpgradeModalTrigger | null;
}

const PLAN_LIMITS = {
  trial: 7,
  basic: 20,
  pro: 50,
  unlimited: Infinity,
};

export function useUsageLimit(): UsageLimitInfo {
  const { user } = useAuth();
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  });

  return useMemo(() => {
    // Default values when no user or plan info
    if (!user || !planInfo) {
      return {
        currentPlan: "trial" as const,
        consultationsUsed: 0,
        consultationsLimit: 7,
        isLimitReached: false,
        isTrialExpired: false,
        hasNegotiationAccess: false,
        trigger: null,
        usagePercentage: 0,
        shouldShowUpgradeModal: () => false,
        getUpgradeTrigger: () => null,
      };
    }

    const currentPlan = planInfo.tier as "trial" | "basic" | "pro" | "unlimited";
    const consultationsUsed = planInfo.used || 0;
    const consultationsLimit = planInfo.limit || PLAN_LIMITS[currentPlan];
    const isTrialExpired = planInfo.isTrialExpired || false;
    const hasNegotiationAccess = planInfo.hasNegotiationAccess || false;
    
    // Calculate if limit is reached
    const isLimitReached = consultationsLimit !== null && consultationsUsed >= consultationsLimit;
    
    // Calculate usage percentage
    const usagePercentage = consultationsLimit 
      ? Math.min(100, (consultationsUsed / consultationsLimit) * 100)
      : 0;

    // Determine trigger based on current state
    const getUpgradeTrigger = (): UpgradeModalTrigger | null => {
      // Trial expired (by time or by count)
      if (currentPlan === "trial" && (isTrialExpired || isLimitReached)) {
        return "trial_limit";
      }
      
      // Basic limit reached
      if (currentPlan === "basic" && isLimitReached) {
        return "basic_limit";
      }
      
      // Pro limit reached
      if (currentPlan === "pro" && isLimitReached) {
        return "pro_limit";
      }
      
      return null;
    };

    const trigger = getUpgradeTrigger();

    const shouldShowUpgradeModal = (): boolean => {
      return trigger !== null;
    };

    return {
      currentPlan,
      consultationsUsed,
      consultationsLimit,
      isLimitReached,
      isTrialExpired,
      hasNegotiationAccess,
      trigger,
      usagePercentage,
      shouldShowUpgradeModal,
      getUpgradeTrigger,
    };
  }, [user, planInfo]);
}

/**
 * Hook to check if a specific feature is gated
 */
export function useFeatureGate(featureName: string): {
  isLocked: boolean;
  trigger: UpgradeModalTrigger | null;
} {
  const { hasNegotiationAccess, currentPlan } = useUsageLimit();

  return useMemo(() => {
    // Check Negotiation tab access
    if (featureName === "Negociação" || featureName === "negotiation") {
      const isLocked = !hasNegotiationAccess && currentPlan === "basic";
      return {
        isLocked,
        trigger: isLocked ? "feature_gate" : null,
      };
    }

    // Default: not locked
    return {
      isLocked: false,
      trigger: null,
    };
  }, [featureName, hasNegotiationAccess, currentPlan]);
}

/**
 * Parse error message from backend to extract trigger info
 * Format: LIMIT_EXCEEDED:tier:used:message
 */
export function parseBackendError(errorMessage: string): {
  isLimitExceeded: boolean;
  tier?: string;
  used?: number;
  message?: string;
} {
  if (!errorMessage?.startsWith('LIMIT_EXCEEDED:')) {
    return { isLimitExceeded: false };
  }
  
  const parts = errorMessage.split(':');
  if (parts.length >= 4) {
    return {
      isLimitExceeded: true,
      tier: parts[1],
      used: parseInt(parts[2], 10),
      message: parts.slice(3).join(':'),
    };
  }
  
  return { isLimitExceeded: true };
}

/**
 * Get upgrade trigger from error message
 */
export function getTriggerFromError(errorMessage: string): UpgradeModalTrigger {
  const parsed = parseBackendError(errorMessage);
  
  if (!parsed.isLimitExceeded) {
    return 'trial_limit';
  }
  
  switch (parsed.tier) {
    case 'trial':
      return 'trial_limit';
    case 'basic':
      return 'basic_limit';
    case 'pro':
      return 'pro_limit';
    default:
      return 'trial_limit';
  }
}

export default useUsageLimit;
