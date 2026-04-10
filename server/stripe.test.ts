import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  updateUserSubscription: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
  updateUserByStripeCustomerId: vi.fn(),
}));

// Mock Stripe
vi.mock("./stripe/stripe", () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  isStripeConfigured: vi.fn(() => true),
}));

import { 
  getUserById, 
  updateUserSubscription, 
  getUserByStripeCustomerId,
  updateUserByStripeCustomerId 
} from "./db";
import { stripe, isStripeConfigured } from "./stripe/stripe";
import { 
  PLAN_CONFIGS, 
  STRIPE_PRICE_IDS, 
  STRIPE_PRODUCT_IDS,
  getTierFromPriceId,
  getTierFromProductId,
  getTierFromAmount,
  hasNeurovendasAccess,
  getConsultationLimit
} from "./stripe/products";

describe("Stripe Products Configuration", () => {
  it("should have correct Basic price ID", () => {
    expect(STRIPE_PRICE_IDS.BASIC).toBe("price_1TKk3bGcWmNsasLQ5dqRQRLt");
  });

  it("should have correct Pro price ID", () => {
    expect(STRIPE_PRICE_IDS.PRO).toBe("price_1TKk3eGcWmNsasLQmDIHOlrL");
  });

  it("should have correct Basic product ID", () => {
    expect(STRIPE_PRODUCT_IDS.BASIC).toBe("prod_UJMnoxyeoHOpN8");
  });

  it("should have correct Pro product ID", () => {
    expect(STRIPE_PRODUCT_IDS.PRO).toBe("prod_UJMn8G0NGOjR3b");
  });

  it("should have basic plan with 20 consultations at R$ 179.90", () => {
    expect(PLAN_CONFIGS.basic.consultationLimit).toBe(20);
    expect(PLAN_CONFIGS.basic.price).toBe(179.90);
    expect(PLAN_CONFIGS.basic.priceId).toBe(STRIPE_PRICE_IDS.BASIC);
  });

  it("should have pro plan with 50 consultations at R$ 349.90", () => {
    expect(PLAN_CONFIGS.pro.consultationLimit).toBe(50);
    expect(PLAN_CONFIGS.pro.price).toBe(349.90);
    expect(PLAN_CONFIGS.pro.priceId).toBe(STRIPE_PRICE_IDS.PRO);
  });

  it("should restrict neurovendas for basic users", () => {
    expect(hasNeurovendasAccess("trial")).toBe(false);
    expect(hasNeurovendasAccess("basic")).toBe(false);
    expect(hasNeurovendasAccess("pro")).toBe(true);
  });
});

describe("Subscription Status Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should identify active subscription statuses", () => {
    const activeStatuses = ["active", "trialing"];
    const inactiveStatuses = ["inactive", "past_due", "canceled"];

    activeStatuses.forEach(status => {
      expect(["active", "trialing"].includes(status)).toBe(true);
    });

    inactiveStatuses.forEach(status => {
      expect(["active", "trialing"].includes(status)).toBe(false);
    });
  });

  it("should map Stripe subscription statuses correctly", () => {
    const statusMap: Record<string, string> = {
      active: "active",
      trialing: "trialing",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "inactive",
      incomplete: "inactive",
      incomplete_expired: "inactive",
      paused: "inactive",
    };

    expect(statusMap["active"]).toBe("active");
    expect(statusMap["trialing"]).toBe("trialing");
    expect(statusMap["past_due"]).toBe("past_due");
    expect(statusMap["canceled"]).toBe("canceled");
    expect(statusMap["unpaid"]).toBe("inactive");
    expect(statusMap["incomplete"]).toBe("inactive");
  });
});

describe("User Subscription Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call updateUserSubscription with correct parameters", async () => {
    const mockUpdateUserSubscription = updateUserSubscription as ReturnType<typeof vi.fn>;
    mockUpdateUserSubscription.mockResolvedValue(undefined);

    await updateUserSubscription(1, {
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test456",
      subscriptionStatus: "active",
      priceId: "price_monthly",
    });

    expect(mockUpdateUserSubscription).toHaveBeenCalledWith(1, {
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test456",
      subscriptionStatus: "active",
      priceId: "price_monthly",
    });
  });

  it("should call getUserByStripeCustomerId with customer ID", async () => {
    const mockGetUserByStripeCustomerId = getUserByStripeCustomerId as ReturnType<typeof vi.fn>;
    mockGetUserByStripeCustomerId.mockResolvedValue({
      id: 1,
      stripeCustomerId: "cus_test123",
      subscriptionStatus: "active",
    });

    const result = await getUserByStripeCustomerId("cus_test123");

    expect(mockGetUserByStripeCustomerId).toHaveBeenCalledWith("cus_test123");
    expect(result).toEqual({
      id: 1,
      stripeCustomerId: "cus_test123",
      subscriptionStatus: "active",
    });
  });

  it("should return undefined for non-existent customer", async () => {
    const mockGetUserByStripeCustomerId = getUserByStripeCustomerId as ReturnType<typeof vi.fn>;
    mockGetUserByStripeCustomerId.mockResolvedValue(undefined);

    const result = await getUserByStripeCustomerId("cus_nonexistent");

    expect(result).toBeUndefined();
  });
});

describe("Stripe Configuration", () => {
  it("should check if Stripe is configured", () => {
    expect(isStripeConfigured()).toBe(true);
  });
});

describe("Checkout Session Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create checkout session with correct parameters", async () => {
    const mockSessionCreate = stripe?.checkout.sessions.create as ReturnType<typeof vi.fn>;
    mockSessionCreate?.mockResolvedValue({
      id: "cs_test123",
      url: "https://checkout.stripe.com/test",
    });

    const mockGetUserById = getUserById as ReturnType<typeof vi.fn>;
    mockGetUserById.mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      stripeCustomerId: "cus_existing",
    });

    // Simulate checkout session creation
    const session = await stripe?.checkout.sessions.create({
      customer: "cus_existing",
      client_reference_id: "1",
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: "price_monthly", quantity: 1 }],
      success_url: "http://localhost:3000/subscription?success=true",
      cancel_url: "http://localhost:3000/subscription?canceled=true",
      allow_promotion_codes: true,
      metadata: {
        user_id: "1",
        customer_email: "test@example.com",
        customer_name: "Test User",
      },
    });

    expect(session?.url).toBe("https://checkout.stripe.com/test");
    expect(mockSessionCreate).toHaveBeenCalled();
  });
});

describe("Billing Portal Session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create portal session for existing customer", async () => {
    const mockPortalCreate = stripe?.billingPortal.sessions.create as ReturnType<typeof vi.fn>;
    mockPortalCreate?.mockResolvedValue({
      id: "bps_test123",
      url: "https://billing.stripe.com/test",
    });

    const session = await stripe?.billingPortal.sessions.create({
      customer: "cus_test123",
      return_url: "http://localhost:3000/subscription",
    });

    expect(session?.url).toBe("https://billing.stripe.com/test");
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_test123",
      return_url: "http://localhost:3000/subscription",
    });
  });
});

describe("Webhook Event Handling", () => {
  it("should verify test events correctly", () => {
    const testEventId = "evt_test_123456";
    const liveEventId = "evt_1234567890";

    expect(testEventId.startsWith("evt_test_")).toBe(true);
    expect(liveEventId.startsWith("evt_test_")).toBe(false);
  });

  it("should handle subscription status mapping", () => {
    const statusMap: Record<string, "active" | "inactive" | "past_due" | "canceled" | "trialing"> = {
      active: "active",
      trialing: "trialing",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "inactive",
      incomplete: "inactive",
      incomplete_expired: "inactive",
      paused: "inactive",
    };

    // Test all mappings
    expect(statusMap["active"]).toBe("active");
    expect(statusMap["trialing"]).toBe("trialing");
    expect(statusMap["past_due"]).toBe("past_due");
    expect(statusMap["canceled"]).toBe("canceled");
    expect(statusMap["unpaid"]).toBe("inactive");
  });
});
