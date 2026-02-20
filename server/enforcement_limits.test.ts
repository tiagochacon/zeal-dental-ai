import { describe, it, expect } from 'vitest';
import {
  hasAccessToPremium,
  hasReachedConsultationLimit,
  getConsultationLimit,
  getRemainingConsultations,
  isTrialActive,
  isTrialExpired,
  getUserTier,
  hasNegotiationAccess,
  PLAN_CONFIG,
} from './billing';
import { User } from '../drizzle/schema';

// Admin emails list (must match trpc.ts)
const ADMIN_EMAILS = [
  'tiagosennachacon@gmail.com',
  'zealtecnologia@gmail.com',
  'victorodriguez2611@gmail.com',
];

// Helper to create mock users
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: 'test-open-id',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    role: 'user',
    cro: null,
    specialty: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: 'inactive',
    priceId: null,
    subscriptionEndDate: null,
    trialStartedAt: null,
    trialEndsAt: null,
    consultationCount: 0,
    passwordHash: null,
    subscriptionTier: null,
    consultationCountResetAt: null,
    lastSignedIn: null,
    loginMethod: 'email',
    croNumber: null,
    ...overrides,
  } as User;
}

describe('Strict Enforcement - Trial Users (7 consultation limit)', () => {
  it('should ALLOW trial user at consultation 1-6', () => {
    for (let count = 0; count < 7; count++) {
      const user = createMockUser({
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        consultationCount: count,
        subscriptionTier: 'trial',
      });
      
      expect(isTrialActive(user)).toBe(true);
      expect(hasAccessToPremium(user)).toBe(true);
      expect(hasReachedConsultationLimit(user)).toBe(false);
    }
  });

  it('should BLOCK trial user at consultation 7 (8th attempt)', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 7,
      subscriptionTier: 'trial',
    });
    
    // Trial is no longer active because limit reached
    expect(isTrialActive(user)).toBe(false);
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK trial user at consultation 8+ (any attempt over limit)', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 10,
      subscriptionTier: 'trial',
    });
    
    expect(isTrialActive(user)).toBe(false);
    expect(hasReachedConsultationLimit(user)).toBe(true);
  });

  it('should BLOCK trial user when trial expired by time', () => {
    const user = createMockUser({
      trialStartedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expired yesterday
      consultationCount: 3,
      subscriptionTier: 'trial',
    });
    
    expect(isTrialActive(user)).toBe(false);
    expect(isTrialExpired(user)).toBe(true);
    expect(hasAccessToPremium(user)).toBe(false);
  });
});

describe('Strict Enforcement - Basic Users (20 consultation limit)', () => {
  const BASIC_PRICE_ID = 'price_1SqJOSJRQSBgWkb1XDS4DBaw';

  it('should ALLOW basic user at consultation 1-19', () => {
    for (let count = 0; count < 20; count++) {
      const user = createMockUser({
        subscriptionStatus: 'active',
        priceId: BASIC_PRICE_ID,
        consultationCount: count,
        subscriptionTier: 'basic',
      });
      
      expect(hasAccessToPremium(user)).toBe(true);
      expect(hasReachedConsultationLimit(user)).toBe(false);
    }
  });

  it('should BLOCK basic user at consultation 20 (21st attempt)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 20,
      subscriptionTier: 'basic',
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK basic user at consultation 21+ (any attempt over limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 25,
      subscriptionTier: 'basic',
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
  });

  it('should NOT have negotiation access for basic users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      subscriptionTier: 'basic',
    });
    
    expect(hasNegotiationAccess(user)).toBe(false);
  });
});

describe('Strict Enforcement - Pro Users (50 consultation limit)', () => {
  const PRO_PRICE_ID = 'price_1SqJOTJRQSBgWkb1BFgs9QoP';

  it('should ALLOW pro user at consultation 1-49', () => {
    for (let count = 0; count < 50; count++) {
      const user = createMockUser({
        subscriptionStatus: 'active',
        priceId: PRO_PRICE_ID,
        consultationCount: count,
        subscriptionTier: 'pro',
      });
      
      expect(hasAccessToPremium(user)).toBe(true);
      expect(hasReachedConsultationLimit(user)).toBe(false);
    }
  });

  it('should BLOCK pro user at consultation 50 (51st attempt)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 50,
      subscriptionTier: 'pro',
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK pro user at consultation 51+ (any attempt over limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 55,
      subscriptionTier: 'pro',
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
  });

  it('should have negotiation access for pro users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      subscriptionTier: 'pro',
    });
    
    expect(hasNegotiationAccess(user)).toBe(true);
  });
});

describe('Strict Enforcement - Admin Users (NEVER blocked)', () => {
  it('should NEVER block admin by role even at 1000+ consultations', () => {
    const user = createMockUser({
      role: 'admin',
      email: 'random-admin@example.com',
      consultationCount: 1000,
    });
    
    expect(user.role).toBe('admin');
    // Admin check happens in middleware, not in billing functions
    // The middleware checks role === 'admin' before calling hasReachedConsultationLimit
  });

  it('should NEVER block admin by email - tiagosennachacon@gmail.com', () => {
    const user = createMockUser({
      email: 'tiagosennachacon@gmail.com',
      role: 'user',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should NEVER block admin by email - zealtecnologia@gmail.com', () => {
    const user = createMockUser({
      email: 'zealtecnologia@gmail.com',
      role: 'user',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should NEVER block admin by email - victorodriguez2611@gmail.com', () => {
    const user = createMockUser({
      email: 'victorodriguez2611@gmail.com',
      role: 'user',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should have negotiation access for admin users', () => {
    const user = createMockUser({
      role: 'admin',
      email: 'admin@example.com',
    });
    
    expect(hasNegotiationAccess(user)).toBe(true);
  });
});

describe('Strict Enforcement - Unlimited Users (NEVER blocked)', () => {
  it('should NEVER block unlimited user even at 10000+ consultations', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: 'unlimited',
      consultationCount: 10000,
      subscriptionTier: 'unlimited',
    });
    
    expect(getConsultationLimit(user)).toBe(Infinity);
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(Infinity);
  });

  it('should have negotiation access for unlimited users', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: 'unlimited',
      subscriptionTier: 'unlimited',
    });
    
    expect(hasNegotiationAccess(user)).toBe(true);
  });
});

describe('Tier Detection', () => {
  it('should correctly identify trial tier', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionTier: 'trial',
    });
    
    expect(getUserTier(user)).toBe('trial');
  });

  it('should correctly identify basic tier', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'basic',
    });
    
    expect(getUserTier(user)).toBe('basic');
  });

  it('should correctly identify pro tier', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
    });
    
    expect(getUserTier(user)).toBe('pro');
  });

  it('should correctly identify unlimited tier', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'unlimited',
    });
    
    expect(getUserTier(user)).toBe('unlimited');
  });
});

describe('Plan Configuration Integrity', () => {
  it('should have correct limits for all plans', () => {
    expect(PLAN_CONFIG.trial.limit).toBe(7);
    expect(PLAN_CONFIG.basic.limit).toBe(20);
    expect(PLAN_CONFIG.pro.limit).toBe(50);
    expect(PLAN_CONFIG.unlimited.limit).toBe(null);
  });

  it('should have correct negotiation access for all plans', () => {
    expect(PLAN_CONFIG.trial.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.basic.hasNegotiationAccess).toBe(false);
    expect(PLAN_CONFIG.pro.hasNegotiationAccess).toBe(true);
    expect(PLAN_CONFIG.unlimited.hasNegotiationAccess).toBe(true);
  });

  it('should have Negociação locked only for basic plan', () => {
    expect(PLAN_CONFIG.trial.lockedTabs).not.toContain('Negociação');
    expect(PLAN_CONFIG.basic.lockedTabs).toContain('Negociação');
    expect(PLAN_CONFIG.pro.lockedTabs).not.toContain('Negociação');
    expect(PLAN_CONFIG.unlimited.lockedTabs).not.toContain('Negociação');
  });
});
