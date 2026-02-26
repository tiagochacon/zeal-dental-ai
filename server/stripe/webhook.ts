import { Request, Response, Router } from "express";
import { stripe, isStripeConfigured } from "./stripe";
import { 
  getUserByStripeCustomerId, 
  updateUserByStripeCustomerId,
  updateUserSubscription,
  getUserById,
  getUserByEmail,
  ensureUserIsGestor
} from "../db";
import { 
  getTierFromPriceId, 
  getTierFromProductId, 
  getTierFromAmount,
  STRIPE_PRICE_IDS,
  STRIPE_PRODUCT_IDS,
  PlanTier
} from "./products";
import { getDb } from "../db";
import { paymentLogs, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const router = Router();

// ============================================
// IDEMPOTENCY: Check if event was already processed
// ============================================
async function isEventProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select()
    .from(paymentLogs)
    .where(eq(paymentLogs.eventId, eventId))
    .limit(1);
  return existing.length > 0;
}

// ============================================
// AUDIT LOG: Record all webhook events
// ============================================
async function logPaymentEvent(
  eventId: string,
  eventType: string,
  status: "success" | "failed" | "duplicate" | "ignored",
  data: {
    userId?: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    priceId?: string;
    productId?: string;
    planType?: PlanTier;
    amount?: number;
    currency?: string;
    errorMessage?: string;
    rawPayload?: any;
  }
) {
  try {
    const db = await getDb();
    if (!db) {
      console.error(`[Webhook] Cannot log event: database not available`);
      return;
    }
    await db.insert(paymentLogs).values({
      eventId,
      eventType,
      status,
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      priceId: data.priceId,
      productId: data.productId,
      planType: data.planType,
      amount: data.amount,
      currency: data.currency,
      errorMessage: data.errorMessage,
      rawPayload: data.rawPayload,
    });
    console.log(`[Webhook] Event logged: ${eventId} - ${status}`);
  } catch (err) {
    // If duplicate key error, it's fine (idempotency)
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!message.includes("Duplicate entry")) {
      console.error(`[Webhook] Failed to log event: ${message}`);
    }
  }
}

// ============================================
// PLAN DETECTION: Robust tier identification
// ============================================
/**
 * Determine tier from checkout session by fetching line_items from Stripe API.
 * IMPORTANT: Stripe does NOT include line_items in webhook payload by default.
 * We MUST fetch them via API to get the Product ID.
 */
async function determineTierFromCheckoutAsync(sessionId: string): Promise<PlanTier> {
  console.log(`[Webhook] Determining tier from checkout session ${sessionId}...`);
  console.log(`[Webhook] IMPORTANT: Fetching line_items from Stripe API (not included in webhook)`);
  
  if (!stripe) {
    console.error(`[Webhook] Stripe not initialized`);
    return "basic";
  }

  try {
    // CRITICAL: Fetch session with line_items expanded from Stripe API
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    });

    console.log(`[Webhook] Retrieved session with line_items`);
    
    const lineItems = sessionWithLineItems.line_items?.data;
    if (lineItems && lineItems.length > 0) {
      const lineItem = lineItems[0];
      
      // Get Product ID (MOST RELIABLE - works with 100% coupons)
      const product = lineItem.price?.product;
      const productId = typeof product === 'string' ? product : product?.id;
      
      if (productId) {
        console.log(`[Webhook] Found Product ID: ${productId}`);
        const tierFromProduct = getTierFromProductId(productId);
        if (tierFromProduct) {
          console.log(`[Webhook] ✅ TIER IDENTIFIED FROM PRODUCT ID: ${tierFromProduct.toUpperCase()}`);
          return tierFromProduct;
        }
      }
      
      // Fallback: Get Price ID
      const priceId = lineItem.price?.id;
      if (priceId) {
        console.log(`[Webhook] Found Price ID: ${priceId}`);
        const tierFromPrice = getTierFromPriceId(priceId);
        if (tierFromPrice) {
          console.log(`[Webhook] ✅ TIER IDENTIFIED FROM PRICE ID: ${tierFromPrice.toUpperCase()}`);
          return tierFromPrice;
        }
      }
    }

    // Check metadata as secondary source
    const tierFromMetadata = sessionWithLineItems.metadata?.plan_tier || sessionWithLineItems.metadata?.tier;
    if (tierFromMetadata === "basic" || tierFromMetadata === "pro") {
      console.log(`[Webhook] Tier from metadata: ${tierFromMetadata}`);
      return tierFromMetadata;
    }

  } catch (error) {
    console.error(`[Webhook] Error fetching session line_items:`, error);
  }

  // NEVER use amount as fallback - it fails with coupons
  console.warn(`[Webhook] ⚠️ Could not determine tier. Defaulting to BASIC.`);
  return "basic";
}

function determineTierFromSubscription(subscription: Stripe.Subscription): PlanTier {
  console.log(`[Webhook] Determining tier from subscription...`);
  console.log(`[Webhook] IMPORTANT: Using Product ID as primary identifier (supports coupons/discounts)`);
  
  // 1. PRIORITY: Check Product ID from subscription items (MOST RELIABLE)
  const productId = subscription.items.data[0]?.price?.product as string;
  if (productId) {
    const tierFromProduct = getTierFromProductId(productId);
    if (tierFromProduct) {
      console.log(`[Webhook] ✅ Tier from PRODUCT ID (${productId}): ${tierFromProduct.toUpperCase()}`);
      return tierFromProduct;
    }
  }

  // 2. Check Price ID as secondary source
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId) {
    const tierFromPrice = getTierFromPriceId(priceId);
    if (tierFromPrice) {
      console.log(`[Webhook] ✅ Tier from PRICE ID (${priceId}): ${tierFromPrice.toUpperCase()}`);
      return tierFromPrice;
    }
  }

  // 3. Check metadata as tertiary source
  const tierFromMetadata = subscription.metadata?.plan_tier || subscription.metadata?.tier;
  if (tierFromMetadata === "basic" || tierFromMetadata === "pro") {
    console.log(`[Webhook] Tier from subscription metadata: ${tierFromMetadata}`);
    return tierFromMetadata;
  }

  // 4. Default to basic (never use amount)
  console.warn(`[Webhook] ⚠️ Could not determine tier from Product/Price ID. Defaulting to BASIC.`);
  return "basic";
}

// ============================================
// WEBHOOK ENDPOINT
// ============================================
router.post(
  "/",
  async (req: Request, res: Response) => {
    if (!stripe || !isStripeConfigured()) {
      console.log("[Webhook] Stripe not configured, ignoring webhook");
      return res.status(400).json({ error: "Stripe not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    
    // Try multiple webhook secrets (primary and backup)
    const webhookSecrets = [
      process.env.STRIPE_WEBHOOK_SECRET,
      process.env.STRIPE_WEBHOOKS,
      process.env.SRTIPE_WEBHOOKS_2,
      process.env.STRIPE_WEBHOOK_SECRET_2,
    ].filter(Boolean) as string[];

    if (webhookSecrets.length === 0) {
      console.error("[Webhook] No STRIPE_WEBHOOK_SECRET configured");
      return res.status(400).json({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event | null = null;
    let lastError: Error | null = null;

    // Try each secret until one works
    for (const secret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
        console.log(`[Webhook] Signature verified successfully`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");
      }
    }

    if (!event) {
      const message = lastError?.message || "Unknown error";
      console.error(`[Webhook] Signature verification failed: ${message}`);
      return res.status(400).json({ error: `Webhook Error: ${message}` });
    }

    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // IDEMPOTENCY CHECK
    if (await isEventProcessed(event.id)) {
      console.log(`[Webhook] Event ${event.id} already processed, skipping`);
      await logPaymentEvent(event.id, event.type, "duplicate", {});
      return res.json({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(event.id, session);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(event.id, subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(event.id, subscription);
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(event.id, invoice);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailed(event.id, invoice);
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
          await logPaymentEvent(event.id, event.type, "ignored", {});
      }

      res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Webhook] Error processing event: ${message}`);
      await logPaymentEvent(event.id, event.type, "failed", { errorMessage: message });
      res.status(500).json({ error: message });
    }
  }
);

// ============================================
// EVENT HANDLERS
// ============================================

async function handleCheckoutCompleted(eventId: string, session: Stripe.Checkout.Session) {
  console.log(`[Webhook] ========== CHECKOUT COMPLETED ==========`);
  console.log(`[Webhook] Session ID: ${session.id}`);
  console.log(`[Webhook] Customer: ${session.customer}`);
  console.log(`[Webhook] Subscription: ${session.subscription}`);
  console.log(`[Webhook] Amount: ${session.amount_total} cents`);
  console.log(`[Webhook] Email: ${session.customer_email}`);
  console.log(`[Webhook] Metadata:`, session.metadata);
  console.log(`[Webhook] Client Reference ID: ${session.client_reference_id}`);
  
  const userId = session.metadata?.user_id || session.client_reference_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  
  // Try to get email from multiple sources
  let customerEmail = session.customer_email || session.metadata?.customer_email;
  
  // If no email in session, fetch from Stripe Customer object
  if (!customerEmail && customerId && stripe) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && 'email' in customer) {
        customerEmail = customer.email || undefined;
        console.log(`[Webhook] Retrieved email from Stripe customer: ${customerEmail}`);
      }
    } catch (err) {
      console.error(`[Webhook] Failed to retrieve customer: ${err}`);
    }
  }
  
  console.log(`[Webhook] Final customer email: ${customerEmail}`);

  // Determine which plan was purchased (MUST fetch line_items from Stripe API)
  const subscriptionTier = await determineTierFromCheckoutAsync(session.id);
  console.log(`[Webhook] ✅ FINAL TIER: ${subscriptionTier.toUpperCase()}`);

  let targetUserId: number | null = null;

  // Method 1: Find user by userId from metadata/client_reference_id
  if (userId) {
    targetUserId = parseInt(userId);
    console.log(`[Webhook] Found user ID from metadata: ${targetUserId}`);
  }

  // Method 2: Find user by email
  if (!targetUserId && customerEmail) {
    const user = await getUserByEmail(customerEmail);
    if (user) {
      targetUserId = user.id;
      console.log(`[Webhook] Found user by email (${customerEmail}): ${targetUserId}`);
    }
  }

  // Method 3: Find user by existing Stripe customer ID
  if (!targetUserId && customerId) {
    const user = await getUserByStripeCustomerId(customerId);
    if (user) {
      targetUserId = user.id;
      console.log(`[Webhook] Found user by Stripe customer ID: ${targetUserId}`);
    }
  }

  if (targetUserId) {
    // Update user subscription AND reset consultation count to 0
    await updateUserSubscription(targetUserId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      subscriptionTier: subscriptionTier,
      consultationCount: 0, // CRITICAL: Reset consultation count when activating new subscription
    });

    // Ensure user becomes gestor with a clinic after payment
    try {
      await ensureUserIsGestor(targetUserId);
      console.log(`[Webhook] ✅ User ${targetUserId} promoted to gestor with clinic`);
    } catch (err) {
      console.error(`[Webhook] ⚠️ Failed to ensure gestor status: ${err}`);
    }

    console.log(`[Webhook] ✅ User ${targetUserId} activated with tier: ${subscriptionTier.toUpperCase()}`);
    console.log(`[Webhook] ✅ Consultation count RESET to 0 for new subscription`);
    console.log(`[Webhook] ==========================================`);

    // Log success
    await logPaymentEvent(eventId, "checkout.session.completed", "success", {
      userId: targetUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      planType: subscriptionTier,
      amount: session.amount_total || undefined,
      currency: session.currency || undefined,
    });
  } else {
    console.warn(`[Webhook] ⚠️ No user found for checkout session`);
    console.warn(`[Webhook] Customer: ${customerId}, Email: ${customerEmail}`);
    console.warn(`[Webhook] User will need to be linked manually`);
    console.log(`[Webhook] ==========================================`);

    // Log as failed (no user found)
    await logPaymentEvent(eventId, "checkout.session.completed", "failed", {
      stripeCustomerId: customerId,
      planType: subscriptionTier,
      amount: session.amount_total || undefined,
      errorMessage: `No user found. Email: ${customerEmail}`,
    });
  }
}

async function handleSubscriptionUpdated(eventId: string, subscription: Stripe.Subscription) {
  console.log(`[Webhook] Subscription updated: ${subscription.id}`);
  
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    await logPaymentEvent(eventId, "subscription.updated", "failed", {
      stripeCustomerId: customerId,
      errorMessage: "No user found for customer",
    });
    return;
  }

  // Determine tier from subscription
  const subscriptionTier = determineTierFromSubscription(subscription);

  // Map Stripe status to our status
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

  const status = statusMap[subscription.status] || "inactive";
  const priceId = subscription.items.data[0]?.price?.id || null;
  const periodEnd = (subscription as any).current_period_end;
  const endDate = periodEnd ? new Date(periodEnd * 1000) : null;

  await updateUserSubscription(user.id, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionTier: status === "active" || status === "trialing" ? subscriptionTier : user.subscriptionTier,
    priceId,
    subscriptionEndDate: endDate,
  });

  console.log(`[Webhook] User ${user.id} subscription: ${status}, tier: ${subscriptionTier}`);

  await logPaymentEvent(eventId, "subscription.updated", "success", {
    userId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    priceId: priceId || undefined,
    planType: subscriptionTier,
  });
}

async function handleSubscriptionDeleted(eventId: string, subscription: Stripe.Subscription) {
  console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
  
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    await logPaymentEvent(eventId, "subscription.deleted", "failed", {
      stripeCustomerId: customerId,
      errorMessage: "No user found for customer",
    });
    return;
  }

  // Revoke access: set status to canceled, tier back to trial, and EXHAUST trial
  // This forces the user to subscribe again to use the system
  // Set consultationCount to 7 (trial limit) so they can't use free trial anymore
  await updateUserSubscription(user.id, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    subscriptionTier: "trial",
    priceId: null,
    subscriptionEndDate: null,
  });
  
  // Also exhaust trial by setting consultation count to max
  const db = await getDb();
  if (db) {
    await db.update(users).set({
      consultationCount: 7, // Trial limit is 7, so this exhausts the trial
    }).where(eq(users.id, user.id));
  }

  console.log(`[Webhook] User ${user.id} subscription canceled - trial EXHAUSTED, must resubscribe`);

  await logPaymentEvent(eventId, "subscription.deleted", "success", {
    userId: user.id,
    stripeCustomerId: customerId,
    planType: "trial",
  });
}

async function handleInvoicePaid(eventId: string, invoice: Stripe.Invoice) {
  console.log(`[Webhook] Invoice paid: ${invoice.id}`);
  
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    await logPaymentEvent(eventId, "invoice.paid", "failed", {
      stripeCustomerId: customerId,
      errorMessage: "No user found for customer",
    });
    return;
  }

  // Reset consultation count on billing cycle renewal
  if ((invoice as any).subscription) {
    const { resetConsultationCount } = await import("../db");
    await resetConsultationCount(user.id);
    console.log(`[Webhook] User ${user.id} consultation count reset for new billing cycle`);
  }

  await logPaymentEvent(eventId, "invoice.paid", "success", {
    userId: user.id,
    stripeCustomerId: customerId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
  });
}

async function handlePaymentFailed(eventId: string, invoice: Stripe.Invoice) {
  console.log(`[Webhook] Payment failed for invoice: ${invoice.id}`);
  
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    await logPaymentEvent(eventId, "invoice.payment_failed", "failed", {
      stripeCustomerId: customerId,
      errorMessage: "No user found for customer",
    });
    return;
  }

  // Mark as past_due
  await updateUserSubscription(user.id, {
    subscriptionStatus: "past_due",
  });

  console.log(`[Webhook] User ${user.id} marked as past_due`);

  await logPaymentEvent(eventId, "invoice.payment_failed", "success", {
    userId: user.id,
    stripeCustomerId: customerId,
    amount: invoice.amount_due,
    currency: invoice.currency,
  });
}

export default router;
