import { describe, it, expect, vi } from 'vitest';
import {
  getUserTier,
  hasNegotiationAccess,
  isTabLocked,
  getConsultationLimit,
  hasReachedConsultationLimit,
  isTrialActive,
  isTrialExpired,
  PLAN_CONFIG,
  getUserPlanInfo,
} from './billing';
import type { User } from '../drizzle/schema';

// Mock user factory
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: 'test-open-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    consultationCount: 0,
    subscriptionStatus: null,
    subscriptionTier: null,
    priceId: null,
    stripeCustomerId: null,
    trialStartedAt: null,
    trialEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: null,
    ...overrides,
  } as User;
}

describe('Subscription Gates - Tier Detection', () => {
  it('should detect trial tier for user with active trial', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      consultationCount: 3,
    });
    expect(getUserTier(user)).toBe('trial');
  });

  it('should detect basic tier for user with basic subscription', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
      priceId: 'price_1SqJOSJRQSBgWkb1XDS4DBaw',
    });
    expect(getUserTier(user)).toBe('basic');
  });

  it('should detect pro tier for user with pro subscription', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
      priceId: 'price_1SqJOTJRQSBgWkb1BFgs9QoP',
    });
    expect(getUserTier(user)).toBe('pro');
  });

  it('should detect unlimited tier for admin users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: 'unlimited',
    });
    expect(getUserTier(user)).toBe('unlimited');
  });

  it('should fallback to trial for new users without subscription', () => {
    const user = createMockUser();
    expect(getUserTier(user)).toBe('trial');
  });
});

describe('Subscription Gates - Negotiation Access', () => {
  it('should grant negotiation access to trial users', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionTier: 'trial',
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it('should DENY negotiation access to basic users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
      priceId: 'price_1SqJOSJRQSBgWkb1XDS4DBaw',
    });
    expect(hasNegotiationAccess(user)).toBe(false);
  });

  it('should grant negotiation access to pro users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
      priceId: 'price_1SqJOTJRQSBgWkb1BFgs9QoP',
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it('should grant negotiation access to unlimited users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'unlimited',
      priceId: 'unlimited',
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });

  it('should grant negotiation access to admin users regardless of tier', () => {
    const user = createMockUser({
      role: 'admin',
      subscriptionTier: 'basic',
    });
    expect(hasNegotiationAccess(user)).toBe(true);
  });
});

describe('Subscription Gates - Tab Locking', () => {
  it('should lock Negociação tab for basic users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
    });
    expect(isTabLocked(user, 'Negociação')).toBe(true);
  });

  it('should NOT lock Negociação tab for pro users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
    });
    expect(isTabLocked(user, 'Negociação')).toBe(false);
  });

  it('should NOT lock any tab for admin users', () => {
    const user = createMockUser({
      role: 'admin',
      subscriptionTier: 'basic',
    });
    expect(isTabLocked(user, 'Negociação')).toBe(false);
  });
});

describe('Subscription Gates - Consultation Limits', () => {
  it('should return 7 consultations for trial users', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionTier: 'trial',
    });
    expect(getConsultationLimit(user)).toBe(7);
  });

  it('should return 20 consultations for basic users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
    });
    expect(getConsultationLimit(user)).toBe(20);
  });

  it('should return 50 consultations for pro users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
    });
    expect(getConsultationLimit(user)).toBe(50);
  });

  it('should return Infinity for unlimited users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'unlimited',
    });
    expect(getConsultationLimit(user)).toBe(Infinity);
  });

  it('should detect when trial user has reached limit', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionTier: 'trial',
      consultationCount: 7,
    });
    expect(hasReachedConsultationLimit(user)).toBe(true);
  });

  it('should NOT detect limit reached for unlimited users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'unlimited',
      consultationCount: 1000,
    });
    expect(hasReachedConsultationLimit(user)).toBe(false);
  });
});

describe('Subscription Gates - Trial Expiration', () => {
  it('should detect active trial', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 3,
    });
    expect(isTrialActive(user)).toBe(true);
    expect(isTrialExpired(user)).toBe(false);
  });

  it('should detect trial expired by time', () => {
    const user = createMockUser({
      trialStartedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      trialEndsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      consultationCount: 3,
    });
    expect(isTrialActive(user)).toBe(false);
    expect(isTrialExpired(user)).toBe(true);
  });

  it('should detect trial expired by consultation count', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 7, // Reached limit
    });
    expect(isTrialActive(user)).toBe(false);
    expect(isTrialExpired(user)).toBe(true);
  });
});

describe('Subscription Gates - Plan Configuration', () => {
  it('should have correct plan configuration for trial', () => {
    expect(PLAN_CONFIG.trial.limit).toBe(7);
    expect(PLAN_CONFIG.trial.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.trial.lockedTabs).toEqual([]);
  });

  it('should have correct plan configuration for basic', () => {
    expect(PLAN_CONFIG.basic.limit).toBe(20);
    expect(PLAN_CONFIG.basic.hasNegotiationAccess).toBe(false);
    expect(PLAN_CONFIG.basic.lockedTabs).toContain('Negociação');
  });

  it('should have correct plan configuration for pro', () => {
    expect(PLAN_CONFIG.pro.limit).toBe(50);
    expect(PLAN_CONFIG.pro.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.pro.lockedTabs).toEqual([]);
  });

  it('should have correct plan configuration for unlimited', () => {
    expect(PLAN_CONFIG.unlimited.limit).toBe(null);
    expect(PLAN_CONFIG.unlimited.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.unlimited.lockedTabs).toEqual([]);
  });
});

describe('Subscription Gates - User Plan Info', () => {
  it('should return complete plan info for trial user', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionTier: 'trial',
      consultationCount: 3,
    });
    
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe('trial');
    expect(info.name).toBe('Trial de 7 dias');
    expect(info.limit).toBe(7);
    expect(info.used).toBe(3);
    expect(info.remaining).toBe(4);
    expect(info.hasNegotiationAccess).toBe(true);
    expect(info.isTrialActive).toBe(true);
  });

  it('should return complete plan info for basic user', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
      consultationCount: 10,
    });
    
    const info = getUserPlanInfo(user);
    expect(info.tier).toBe('basic');
    expect(info.name).toBe('ZEAL Básico');
    expect(info.limit).toBe(20);
    expect(info.used).toBe(10);
    expect(info.remaining).toBe(10);
    expect(info.hasNegotiationAccess).toBe(false);
    expect(info.lockedTabs).toContain('Negociação');
  });

  it('should return null remaining for unlimited user', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'unlimited',
      consultationCount: 100,
    });
    
    const info = getUserPlanInfo(user);
    expect(info.remaining).toBe(null);
  });
});
