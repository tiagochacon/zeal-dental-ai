import { describe, expect, it } from "vitest";
import {
  getUserTier,
  getUserPlanInfo,
  hasNegotiationAccess,
  isTrialActive,
  isTrialExpired,
  isSubscriptionActive,
  calculateTrialEndDate,
  PLAN_CONFIG,
  TRIAL_DAYS,
  TRIAL_CONSULTATION_LIMIT,
} from "./billing";
import type { User } from "../drizzle/schema";

// Helper to create a mock User
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-open-id",
    passwordHash: null,
    name: "Test User",
    email: "test@example.com",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    croNumber: null,
    phone: null,
    specialty: null,
    clinicAddress: null,
    clinicId: null,
    clinicRole: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    priceId: null,
    subscriptionTier: null,
    subscriptionEndDate: null,
    trialStartedAt: null,
    trialEndsAt: null,
    consultationCount: 0,
    consultationCountResetAt: null,
    ...overrides,
  } as User;
}

describe("billing - getUserTier", () => {
  it("returns unlimited for admin users", () => {
    const user = createMockUser({ role: "admin" });
    expect(getUserTier(user)).toBe("unlimited");
  });

  it("returns trial for new user with active trial", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
      consultationCount: 3,
    });
    expect(getUserTier(user)).toBe("trial");
  });

  it("returns basic for active subscription with basic tier", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "basic",
    });
    expect(getUserTier(user)).toBe("basic");
  });

  it("returns pro for active subscription with pro tier", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "pro",
    });
    expect(getUserTier(user)).toBe("pro");
  });

  it("returns unlimited for active subscription with unlimited tier", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "unlimited",
    });
    expect(getUserTier(user)).toBe("unlimited");
  });

  it("prioritizes active subscription over trial", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "pro",
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
    });
    expect(getUserTier(user)).toBe("pro");
  });
});

describe("billing - hasNegotiationAccess", () => {
  it("returns true for admin", () => {
    const user = createMockUser({ role: "admin" });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it("returns true for trial user", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it("returns false for basic user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "basic",
    });
    expect(hasNegotiationAccess(user)).toBe(false);
  });

  it("returns true for pro user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "pro",
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it("returns true for unlimited user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "unlimited",
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });
});

describe("billing - isTrialActive", () => {
  it("returns false when no trial started", () => {
    const user = createMockUser();
    expect(isTrialActive(user)).toBe(false);
  });

  it("returns true when trial is within time and consultation limit", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
      consultationCount: 3,
    });
    expect(isTrialActive(user)).toBe(true);
  });

  it("returns false when trial expired by time", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() - 1);
    const user = createMockUser({
      trialStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      trialEndsAt: trialEnd,
      consultationCount: 3,
    });
    expect(isTrialActive(user)).toBe(false);
  });

  it("returns false when trial expired by consultation count", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
      consultationCount: TRIAL_CONSULTATION_LIMIT,
    });
    expect(isTrialActive(user)).toBe(false);
  });
});

describe("billing - isTrialExpired", () => {
  it("returns true when no trial started", () => {
    const user = createMockUser();
    expect(isTrialExpired(user)).toBe(true);
  });

  it("returns false when trial is active", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
      consultationCount: 0,
    });
    expect(isTrialExpired(user)).toBe(false);
  });
});

describe("billing - getUserPlanInfo", () => {
  it("returns correct info for trial user", () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
      consultationCount: 2,
    });
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe("trial");
    expect(info.name).toBe("Trial de 7 dias");
    expect(info.limit).toBe(7);
    expect(info.used).toBe(2);
    expect(info.hasNegotiationAccess).toBe(true);
    expect(info.isTrialActive).toBe(true);
    expect(info.trialDaysRemaining).toBeGreaterThan(0);
  });

  it("returns correct info for basic user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "basic",
      consultationCount: 10,
    });
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe("basic");
    expect(info.name).toBe("ZEAL Básico");
    expect(info.limit).toBe(20);
    expect(info.used).toBe(10);
    expect(info.remaining).toBe(10);
    expect(info.hasNegotiationAccess).toBe(false);
  });

  it("returns correct info for pro user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "pro",
      consultationCount: 25,
    });
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe("pro");
    expect(info.name).toBe("ZEAL Pro");
    expect(info.limit).toBe(50);
    expect(info.used).toBe(25);
    expect(info.remaining).toBe(25);
    expect(info.hasNegotiationAccess).toBe(true);
  });

  it("returns correct info for unlimited user", () => {
    const user = createMockUser({
      subscriptionStatus: "active",
      subscriptionTier: "unlimited",
      consultationCount: 100,
    });
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe("unlimited");
    expect(info.name).toBe("ZEAL Unlimited");
    expect(info.limit).toBeNull();
    expect(info.remaining).toBeNull();
    expect(info.hasNegotiationAccess).toBe(true);
  });

  it("returns correct info for admin user", () => {
    const user = createMockUser({ role: "admin" });
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe("unlimited");
    expect(info.hasNegotiationAccess).toBe(true);
  });
});

describe("billing - PLAN_CONFIG", () => {
  it("basic plan does NOT have negotiation access", () => {
    expect(PLAN_CONFIG.basic.hasNegotiationAccess).toBe(false);
    expect(PLAN_CONFIG.basic.lockedTabs).toContain("Negociação");
  });

  it("trial plan HAS negotiation access", () => {
    expect(PLAN_CONFIG.trial.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.trial.lockedTabs).toHaveLength(0);
  });

  it("pro plan HAS negotiation access", () => {
    expect(PLAN_CONFIG.pro.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.pro.lockedTabs).toHaveLength(0);
  });

  it("unlimited plan HAS negotiation access", () => {
    expect(PLAN_CONFIG.unlimited.hasNegotiationAccess).toBe(true);
  });
});

describe("billing - calculateTrialEndDate", () => {
  it("returns a date 7 days in the future", () => {
    const endDate = calculateTrialEndDate();
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(TRIAL_DAYS);
  });
});
