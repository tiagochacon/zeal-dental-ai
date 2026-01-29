import { User } from "../drizzle/schema";

export const TRIAL_DAYS = 7;
export const TRIAL_CONSULTATION_LIMIT = 7;

/**
 * Plan configuration matrix
 */
export const PLAN_CONFIG = {
  trial: {
    name: "Trial de 7 dias",
    limit: 7,
    durationDays: 7,
    tabs: ["SOAP", "Odontograma", "Transcrição", "Negociação"] as const,
    lockedTabs: [] as string[],
    hasNegotiationAccess: true,
  },
  basic: {
    name: "ZEAL Básico",
    limit: 20,
    durationDays: null,
    tabs: ["SOAP", "Odontograma", "Transcrição"] as const,
    lockedTabs: ["Negociação"] as string[],
    hasNegotiationAccess: false,
    price_brl: 99.90,
  },
  pro: {
    name: "ZEAL Pro",
    limit: 50,
    durationDays: null,
    tabs: ["SOAP", "Odontograma", "Transcrição", "Negociação"] as const,
    lockedTabs: [] as string[],
    hasNegotiationAccess: true,
    price_brl: 199.90,
  },
  unlimited: {
    name: "ZEAL Unlimited",
    limit: null, // No limit
    durationDays: null,
    tabs: ["SOAP", "Odontograma", "Transcrição", "Negociação"] as const,
    lockedTabs: [] as string[],
    hasNegotiationAccess: true,
    price_brl: null,
  },
} as const;

export type SubscriptionTier = keyof typeof PLAN_CONFIG;

// Legacy PLANS export for backward compatibility
export const PLANS = {
  BASIC: {
    name: PLAN_CONFIG.basic.name,
    consultation_limit: PLAN_CONFIG.basic.limit,
    price_brl: PLAN_CONFIG.basic.price_brl,
  },
  PRO: {
    name: PLAN_CONFIG.pro.name,
    consultation_limit: PLAN_CONFIG.pro.limit,
    price_brl: PLAN_CONFIG.pro.price_brl,
  },
};

/**
 * Get user's subscription tier
 */
export function getUserTier(user: User): SubscriptionTier {
  // Check if user has explicit subscriptionTier set
  if (user.subscriptionTier) {
    return user.subscriptionTier as SubscriptionTier;
  }
  
  // Fallback: determine tier from priceId and subscription status
  if (isTrialActive(user)) {
    return "trial";
  }
  
  if (isSubscriptionActive(user)) {
    const priceId = user.priceId;
    if (priceId === "unlimited") {
      return "unlimited";
    }
    if (priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
      return "pro";
    }
    // Default to basic for any other active subscription
    return "basic";
  }
  
  return "trial"; // Default for new users
}

/**
 * Check if user has an active trial
 */
export function isTrialActive(user: User): boolean {
  if (!user.trialStartedAt || !user.trialEndsAt) {
    return false;
  }
  
  // Check if trial has expired by time
  if (new Date() >= user.trialEndsAt) {
    return false;
  }
  
  // Check if trial has expired by consultation count
  if (user.consultationCount >= TRIAL_CONSULTATION_LIMIT) {
    return false;
  }
  
  return true;
}

/**
 * Check if trial has expired (by time OR by consultation count)
 */
export function isTrialExpired(user: User): boolean {
  if (!user.trialStartedAt || !user.trialEndsAt) {
    return true; // No trial started = expired
  }
  
  // Expired by time
  if (new Date() >= user.trialEndsAt) {
    return true;
  }
  
  // Expired by consultation count
  if (user.consultationCount >= TRIAL_CONSULTATION_LIMIT) {
    return true;
  }
  
  return false;
}

/**
 * Check if user has an active subscription
 */
export function isSubscriptionActive(user: User): boolean {
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

/**
 * Check if user can access premium features
 */
export function hasAccessToPremium(user: User): boolean {
  return isSubscriptionActive(user) || isTrialActive(user);
}

/**
 * Get the consultation limit for a user based on their tier
 */
export function getConsultationLimit(user: User): number {
  const tier = getUserTier(user);
  const config = PLAN_CONFIG[tier];
  
  // Unlimited plan has no limit
  if (config.limit === null) {
    return Infinity;
  }
  
  return config.limit;
}

/**
 * Check if user has reached their consultation limit
 */
export function hasReachedConsultationLimit(user: User): boolean {
  const limit = getConsultationLimit(user);
  if (limit === Infinity) return false;
  return user.consultationCount >= limit;
}

/**
 * Get remaining consultations for the current billing cycle
 */
export function getRemainingConsultations(user: User): number {
  const limit = getConsultationLimit(user);
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - user.consultationCount);
}

/**
 * Check if user has access to Negotiation tab
 */
export function hasNegotiationAccess(user: User): boolean {
  // Admins always have access
  if (user.role === "admin") {
    return true;
  }
  
  const tier = getUserTier(user);
  return PLAN_CONFIG[tier].hasNegotiationAccess;
}

/**
 * Check if a specific tab is locked for the user
 */
export function isTabLocked(user: User, tabName: string): boolean {
  // Admins have access to all tabs
  if (user.role === "admin") {
    return false;
  }
  
  const tier = getUserTier(user);
  return PLAN_CONFIG[tier].lockedTabs.includes(tabName);
}

/**
 * Get the current plan name for a user
 */
export function getUserPlanName(user: User): string {
  const tier = getUserTier(user);
  return PLAN_CONFIG[tier].name;
}

/**
 * Calculate trial end date (7 days from now)
 */
export function calculateTrialEndDate(): Date {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + TRIAL_DAYS);
  return endDate;
}

/**
 * Check if user needs to be redirected to pricing page
 */
export function shouldRedirectToPricing(user: User): boolean {
  return !hasAccessToPremium(user);
}

/**
 * Get user's plan info for frontend display
 */
export function getUserPlanInfo(user: User) {
  const tier = getUserTier(user);
  const config = PLAN_CONFIG[tier];
  const remaining = getRemainingConsultations(user);
  
  return {
    tier,
    name: config.name,
    limit: config.limit,
    used: user.consultationCount,
    remaining: remaining === Infinity ? null : remaining,
    hasNegotiationAccess: config.hasNegotiationAccess,
    lockedTabs: config.lockedTabs,
    isTrialActive: isTrialActive(user),
    isTrialExpired: isTrialExpired(user),
    trialEndsAt: user.trialEndsAt,
  };
}
