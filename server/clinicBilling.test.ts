import { describe, it, expect } from "vitest";
import { isUnlimitedBillingUser, normalizeEffectiveBillingUser } from "./clinicBilling";

describe("Clinic Billing - isUnlimitedBillingUser", () => {
  it("should return true for admin role", () => {
    const user = { role: "admin", subscriptionTier: null, priceId: null, email: "admin@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(true);
  });

  it("should return true for unlimited subscriptionTier", () => {
    const user = { role: "user", subscriptionTier: "unlimited", priceId: null, email: "user@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(true);
  });

  it("should return true for unlimited priceId", () => {
    const user = { role: "user", subscriptionTier: "pro", priceId: "unlimited", email: "user@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(true);
  });

  it("should return false for regular user with pro tier", () => {
    const user = { role: "user", subscriptionTier: "pro", priceId: "price_123", email: "user@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(false);
  });

  it("should return false for regular user with basic tier", () => {
    const user = { role: "user", subscriptionTier: "basic", priceId: "price_456", email: "user@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(false);
  });

  it("should return false for user with null tier and null priceId", () => {
    const user = { role: "user", subscriptionTier: null, priceId: null, email: "user@test.com" } as any;
    expect(isUnlimitedBillingUser(user)).toBe(false);
  });
});

describe("Clinic Billing - normalizeEffectiveBillingUser", () => {
  it("should normalize an admin user to active/unlimited", () => {
    const user = {
      id: 1,
      role: "admin",
      subscriptionTier: null,
      priceId: null,
      subscriptionStatus: null,
      trialStartedAt: "2025-01-01",
      trialEndsAt: "2025-02-01",
      email: "admin@test.com",
    } as any;
    const result = normalizeEffectiveBillingUser(user);
    expect(result.subscriptionStatus).toBe("active");
    expect(result.subscriptionTier).toBe("unlimited");
    expect(result.priceId).toBe("unlimited");
    expect(result.trialStartedAt).toBeNull();
    expect(result.trialEndsAt).toBeNull();
  });

  it("should return user as-is if not unlimited", () => {
    const user = {
      id: 2,
      role: "user",
      subscriptionTier: "pro",
      priceId: "price_123",
      subscriptionStatus: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      email: "user@test.com",
    } as any;
    const result = normalizeEffectiveBillingUser(user);
    expect(result).toEqual(user);
  });

  it("should preserve existing priceId if not null for unlimited user", () => {
    const user = {
      id: 3,
      role: "admin",
      subscriptionTier: "pro",
      priceId: "price_existing",
      subscriptionStatus: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      email: "admin@test.com",
    } as any;
    const result = normalizeEffectiveBillingUser(user);
    expect(result.priceId).toBe("price_existing");
    expect(result.subscriptionTier).toBe("unlimited");
    expect(result.subscriptionStatus).toBe("active");
  });
});
