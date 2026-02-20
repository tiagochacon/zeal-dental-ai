import { describe, it, expect, beforeEach } from "vitest";
import {
  isTrialActive,
  isSubscriptionActive,
  hasAccessToPremium,
  getConsultationLimit,
  hasReachedConsultationLimit,
  getRemainingConsultations,
  getUserPlanName,
  calculateTrialEndDate,
  shouldRedirectToPricing,
  TRIAL_DAYS,
  TRIAL_CONSULTATION_LIMIT,
  PLANS,
} from "./billing";
import { User } from "../drizzle/schema";

// Mock user factory
function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "test-openid",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "oauth",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    croNumber: "123456",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "inactive",
    priceId: null,
    subscriptionEndDate: null,
    trialStartedAt: null,
    trialEndsAt: null,
    consultationCount: 0,
    consultationCountResetAt: now,
    ...overrides,
  };
}

describe("Trial Logic", () => {
  it("should detect active trial", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
    });

    expect(isTrialActive(user)).toBe(true);
  });

  it("should detect expired trial", () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    const user = createMockUser({
      trialStartedAt: new Date(pastDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      trialEndsAt: pastDate,
    });

    expect(isTrialActive(user)).toBe(false);
  });

  it("should detect no trial", () => {
    const user = createMockUser();
    expect(isTrialActive(user)).toBe(false);
  });

  it("should calculate trial end date correctly", () => {
    const endDate = calculateTrialEndDate();
    const now = new Date();
    const expectedEndDate = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // Allow 1 second difference for execution time
    const diff = Math.abs(endDate.getTime() - expectedEndDate.getTime());
    expect(diff).toBeLessThan(1000);
  });
});

describe("Subscription Logic", () => {
  it("should detect active subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
    });

    expect(isSubscriptionActive(user)).toBe(true);
  });

  it("should detect trialing subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "trialing",
    });

    expect(isSubscriptionActive(user)).toBe(true);
  });

  it("should detect inactive subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "inactive",
    });

    expect(isSubscriptionActive(user)).toBe(false);
  });

  it("should detect canceled subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "canceled",
    });

    expect(isSubscriptionActive(user)).toBe(false);
  });
});

describe("Premium Access", () => {
  it("should grant access with active subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
    });

    expect(hasAccessToPremium(user)).toBe(true);
  });

  it("should grant access with active trial", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
    });

    expect(hasAccessToPremium(user)).toBe(true);
  });

  it("should deny access without subscription or trial", () => {
    const user = createMockUser();
    expect(hasAccessToPremium(user)).toBe(false);
  });
});

describe("Consultation Limits", () => {
  it("should return trial limit for active trial", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
    });

    expect(getConsultationLimit(user)).toBe(TRIAL_CONSULTATION_LIMIT);
  });

  it("should return BASIC plan limit", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      priceId: "price_1SqJOSJRQSBgWkb1XDS4DBaw",
    });

    expect(getConsultationLimit(user)).toBe(PLANS.BASIC.consultation_limit);
  });

  it("should return PRO plan limit", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      priceId: "price_1SqJOTJRQSBgWkb1BFgs9QoP",
    });

    expect(getConsultationLimit(user)).toBe(PLANS.PRO.consultation_limit);
  });

  it("should fallback to trial limit for users without subscription", () => {
    const user = createMockUser();
    // New behavior: fallback to trial tier limit (7) instead of 0
    expect(getConsultationLimit(user)).toBe(TRIAL_CONSULTATION_LIMIT);
  });
});

describe("Consultation Count Tracking", () => {
  it("should detect reached limit", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
      consultationCount: TRIAL_CONSULTATION_LIMIT, // At limit
    });

    expect(hasReachedConsultationLimit(user)).toBe(true);
  });

  it("should detect not reached limit", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
      consultationCount: TRIAL_CONSULTATION_LIMIT - 1, // Below limit
    });

    expect(hasReachedConsultationLimit(user)).toBe(false);
  });

  it("should calculate remaining consultations", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
      consultationCount: 3,
    });

    const remaining = getRemainingConsultations(user);
    expect(remaining).toBe(TRIAL_CONSULTATION_LIMIT - 3);
  });

  it("should return 0 remaining when at limit", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
      consultationCount: TRIAL_CONSULTATION_LIMIT,
    });

    const remaining = getRemainingConsultations(user);
    expect(remaining).toBe(0);
  });
});

describe("User Plan Names", () => {
  it("should return trial plan name", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
    });

    expect(getUserPlanName(user)).toBe("Trial de 7 dias");
  });

  it("should return BASIC plan name", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      priceId: "price_1SqJOSJRQSBgWkb1XDS4DBaw",
    });

    expect(getUserPlanName(user)).toBe(PLANS.BASIC.name);
  });

  it("should return PRO plan name", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      priceId: "price_1SqJOTJRQSBgWkb1BFgs9QoP",
    });

    expect(getUserPlanName(user)).toBe(PLANS.PRO.name);
  });

  it("should fallback to trial plan name for users without subscription", () => {
    const user = createMockUser();
    // New behavior: fallback to trial tier name
    expect(getUserPlanName(user)).toBe("Trial de 7 dias");
  });
});

describe("Paywall Logic", () => {
  it("should redirect to pricing when no access", () => {
    const user = createMockUser();
    expect(shouldRedirectToPricing(user)).toBe(true);
  });

  it("should not redirect with active subscription", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
    });

    expect(shouldRedirectToPricing(user)).toBe(false);
  });

  it("should not redirect with active trial", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const user = createMockUser({
      trialStartedAt: now,
      trialEndsAt: futureDate,
    });

    expect(shouldRedirectToPricing(user)).toBe(false);
  });
});

describe("Plans Configuration", () => {
  it("should have BASIC plan configured", () => {
    expect(PLANS.BASIC).toBeDefined();
    expect(PLANS.BASIC.name).toBe("ZEAL Básico");
    expect(PLANS.BASIC.consultation_limit).toBe(20);
    expect(PLANS.BASIC.price_brl).toBe(99.90);
  });

  it("should have PRO plan configured", () => {
    expect(PLANS.PRO).toBeDefined();
    expect(PLANS.PRO.name).toBe("ZEAL Pro");
    expect(PLANS.PRO.consultation_limit).toBe(50);
    expect(PLANS.PRO.price_brl).toBe(199.90);
  });

  it("should have correct trial configuration", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(TRIAL_CONSULTATION_LIMIT).toBe(7);
  });
});
