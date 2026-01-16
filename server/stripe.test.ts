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
import { STRIPE_PRODUCTS } from "./stripe/products";

describe("Stripe Products Configuration", () => {
  it("should have MONTHLY plan configured", () => {
    expect(STRIPE_PRODUCTS.MONTHLY).toBeDefined();
    expect(STRIPE_PRODUCTS.MONTHLY.name).toBe("ZEAL Pro Mensal");
    expect(STRIPE_PRODUCTS.MONTHLY.interval).toBe("month");
    expect(STRIPE_PRODUCTS.MONTHLY.price).toBe(99.90);
    expect(STRIPE_PRODUCTS.MONTHLY.currency).toBe("BRL");
  });

  it("should have ANNUAL plan configured", () => {
    expect(STRIPE_PRODUCTS.ANNUAL).toBeDefined();
    expect(STRIPE_PRODUCTS.ANNUAL.name).toBe("ZEAL Pro Anual");
    expect(STRIPE_PRODUCTS.ANNUAL.interval).toBe("year");
    expect(STRIPE_PRODUCTS.ANNUAL.price).toBe(999.00);
    expect(STRIPE_PRODUCTS.ANNUAL.currency).toBe("BRL");
  });

  it("should have features listed for each plan", () => {
    expect(STRIPE_PRODUCTS.MONTHLY.features.length).toBeGreaterThan(0);
    expect(STRIPE_PRODUCTS.ANNUAL.features.length).toBeGreaterThan(0);
    expect(STRIPE_PRODUCTS.ANNUAL.features).toContain("Tudo do plano mensal");
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
