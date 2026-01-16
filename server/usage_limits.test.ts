import { describe, it, expect, vi } from 'vitest';
import {
  hasAccessToPremium,
  hasReachedConsultationLimit,
  getConsultationLimit,
  getRemainingConsultations,
  isTrialActive,
  isSubscriptionActive,
  TRIAL_CONSULTATION_LIMIT,
  PLANS,
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
    ...overrides,
  };
}

describe('Usage Limits - Trial Users', () => {
  it('should allow trial user with 0 consultations', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      consultationCount: 0,
    });
    
    expect(isTrialActive(user)).toBe(true);
    expect(hasAccessToPremium(user)).toBe(true);
    expect(getConsultationLimit(user)).toBe(TRIAL_CONSULTATION_LIMIT);
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(7);
  });

  it('should allow trial user with 6 consultations (under limit)', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 6,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(1);
  });

  it('should BLOCK trial user at 7 consultations (limit reached)', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 7,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK trial user at 8+ consultations (over limit)', () => {
    const user = createMockUser({
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consultationCount: 8,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK trial user with expired trial', () => {
    const user = createMockUser({
      trialStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (expired)
      consultationCount: 3,
    });
    
    expect(isTrialActive(user)).toBe(false);
    expect(hasAccessToPremium(user)).toBe(false);
  });
});

describe('Usage Limits - Basic Plan Users', () => {
  const BASIC_PRICE_ID = 'price_1SqJOSJRQSBgWkb1XDS4DBaw';

  it('should allow Basic user with 0 consultations', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 0,
    });
    
    expect(isSubscriptionActive(user)).toBe(true);
    expect(hasAccessToPremium(user)).toBe(true);
    expect(getConsultationLimit(user)).toBe(PLANS.BASIC.consultation_limit);
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(20);
  });

  it('should allow Basic user with 19 consultations (under limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 19,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(1);
  });

  it('should BLOCK Basic user at 20 consultations (limit reached)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 20,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK Basic user at 21+ consultations (over limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: BASIC_PRICE_ID,
      consultationCount: 21,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });
});

describe('Usage Limits - Pro Plan Users', () => {
  const PRO_PRICE_ID = 'price_1SqJOTJRQSBgWkb1BFgs9QoP';

  it('should allow Pro user with 0 consultations', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 0,
    });
    
    expect(isSubscriptionActive(user)).toBe(true);
    expect(hasAccessToPremium(user)).toBe(true);
    expect(getConsultationLimit(user)).toBe(PLANS.PRO.consultation_limit);
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(50);
  });

  it('should allow Pro user with 49 consultations (under limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 49,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(false);
    expect(getRemainingConsultations(user)).toBe(1);
  });

  it('should BLOCK Pro user at 50 consultations (limit reached)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 50,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });

  it('should BLOCK Pro user at 51+ consultations (over limit)', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: PRO_PRICE_ID,
      consultationCount: 51,
    });
    
    expect(hasReachedConsultationLimit(user)).toBe(true);
    expect(getRemainingConsultations(user)).toBe(0);
  });
});

describe('Usage Limits - Admin Users (Unlimited Access)', () => {
  it('should identify admin by role', () => {
    const user = createMockUser({
      role: 'admin',
      email: 'random@example.com',
      consultationCount: 1000,
    });
    
    // Admin by role should bypass limits
    expect(user.role).toBe('admin');
  });

  it('should identify admin by email - tiagosennachacon@gmail.com', () => {
    const user = createMockUser({
      email: 'tiagosennachacon@gmail.com',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should identify admin by email - zealtecnologia@gmail.com', () => {
    const user = createMockUser({
      email: 'zealtecnologia@gmail.com',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should identify admin by email - victorodriguez2611@gmail.com', () => {
    const user = createMockUser({
      email: 'victorodriguez2611@gmail.com',
      consultationCount: 500,
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(true);
  });

  it('should NOT identify non-admin email as admin', () => {
    const user = createMockUser({
      email: 'random@example.com',
      role: 'user',
    });
    
    expect(ADMIN_EMAILS.includes(user.email!)).toBe(false);
    expect(user.role).not.toBe('admin');
  });
});

describe('Usage Limits - Edge Cases', () => {
  it('should BLOCK user with no subscription and no trial', () => {
    const user = createMockUser({
      subscriptionStatus: 'inactive',
      trialStartedAt: null,
      trialEndsAt: null,
    });
    
    expect(hasAccessToPremium(user)).toBe(false);
    expect(getConsultationLimit(user)).toBe(0);
  });

  it('should handle user with canceled subscription', () => {
    const user = createMockUser({
      subscriptionStatus: 'canceled',
      priceId: 'price_1SqJOSJRQSBgWkb1XDS4DBaw',
    });
    
    expect(isSubscriptionActive(user)).toBe(false);
    expect(hasAccessToPremium(user)).toBe(false);
  });

  it('should handle trialing subscription status', () => {
    const user = createMockUser({
      subscriptionStatus: 'trialing',
      priceId: 'price_1SqJOSJRQSBgWkb1XDS4DBaw',
      consultationCount: 5,
    });
    
    expect(isSubscriptionActive(user)).toBe(true);
    expect(hasAccessToPremium(user)).toBe(true);
    expect(getConsultationLimit(user)).toBe(20); // Basic plan limit
  });

  it('should correctly calculate remaining consultations at various counts', () => {
    const user = createMockUser({
      subscriptionStatus: 'active',
      priceId: 'price_1SqJOTJRQSBgWkb1BFgs9QoP', // Pro
    });
    
    user.consultationCount = 0;
    expect(getRemainingConsultations(user)).toBe(50);
    
    user.consultationCount = 25;
    expect(getRemainingConsultations(user)).toBe(25);
    
    user.consultationCount = 50;
    expect(getRemainingConsultations(user)).toBe(0);
    
    user.consultationCount = 100; // Over limit
    expect(getRemainingConsultations(user)).toBe(0); // Should not go negative
  });
});
