import { User } from "../drizzle/schema";

export const TRIAL_DAYS = 7;
export const TRIAL_CONSULTATION_LIMIT = 7;

export const PLANS = {
  BASIC: {
    name: "ZEAL Básico",
    consultation_limit: 20,
    price_brl: 99.90,
  },
  PRO: {
    name: "ZEAL Pro",
    consultation_limit: 50,
    price_brl: 199.90,
  },
};

/**
 * Check if user has an active trial
 */
export function isTrialActive(user: User): boolean {
  if (!user.trialStartedAt || !user.trialEndsAt) {
    return false;
  }
  return new Date() < user.trialEndsAt;
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
 * Get the consultation limit for a user based on their plan/trial
 */
export function getConsultationLimit(user: User): number {
  if (isTrialActive(user)) {
    return TRIAL_CONSULTATION_LIMIT;
  }

  if (isSubscriptionActive(user)) {
    const priceId = user.priceId;
    // Match price ID to plan
    if (priceId?.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) {
      return PLANS.BASIC.consultation_limit;
    } else if (priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
      return PLANS.PRO.consultation_limit;
    }
  }

  return 0; // No access
}

/**
 * Check if user has reached their consultation limit
 */
export function hasReachedConsultationLimit(user: User): boolean {
  const limit = getConsultationLimit(user);
  return user.consultationCount >= limit;
}

/**
 * Get remaining consultations for the current billing cycle
 */
export function getRemainingConsultations(user: User): number {
  const limit = getConsultationLimit(user);
  return Math.max(0, limit - user.consultationCount);
}

/**
 * Get the current plan name for a user
 */
export function getUserPlanName(user: User): string {
  if (isTrialActive(user)) {
    return "Trial de 7 dias";
  }

  if (isSubscriptionActive(user)) {
    const priceId = user.priceId;
    if (priceId?.includes("price_1SqJOSJRQSBgWkb1XDS4DBaw")) {
      return PLANS.BASIC.name;
    } else if (priceId?.includes("price_1SqJOTJRQSBgWkb1BFgs9QoP")) {
      return PLANS.PRO.name;
    }
  }

  return "Sem plano";
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
