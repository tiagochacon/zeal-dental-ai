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
import { supabase } from "../lib/supabaseClient";
import Stripe from "stripe";

const router = Router();

// ============================================
// IDEMPOTENCY: Check if event was already processed
// ============================================
async function isEventProcessed(eventId: string): Promise<boolean> {
  if (!supabase) {
    console.warn("[Webhook] Supabase not configured. Skipping idempotency check.");
    return false;
  }
  const { data, error } = await supabase
    .from("Payment_logs")
    .select("id")
    .eq("eventId", eventId)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// ============================================
// LOGGING: Log all payment events for audit trail
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
    // @ts-ignore - Supabase schema mismatch during migration
    const { error } = await supabase.from("Payment_logs").insert({
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
    if (error) {
      if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
        console.error(`[Webhook] Failed to log event: ${error.message}`);
      }
    }
  } catch (err) {
    console.error("[Webhook] Error logging payment event:", err);
  }
}

// ============================================
// WEBHOOK HANDLERS
// ============================================

// Handle checkout.session.completed
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, eventId: string) {
  const stripeCustomerId = session.customer as string;
  const priceId = (session.line_items?.data[0]?.price?.id || session.metadata?.priceId) as string;
  const productId = session.line_items?.data[0]?.price?.product as string;

  if (!stripeCustomerId || !priceId) {
    console.error("[Webhook] Missing customer or price in checkout session");
    await logPaymentEvent(eventId, "checkout.session.completed", "failed", {
      errorMessage: "Missing customer or price",
    });
    return;
  }

  try {
    const user = await getUserByStripeCustomerId(stripeCustomerId);
    if (!user) {
      console.error(`[Webhook] User not found for customer ${stripeCustomerId}`);
      await logPaymentEvent(eventId, "checkout.session.completed", "failed", {
        stripeCustomerId,
        errorMessage: "User not found",
      });
      return;
    }

    const tier = getTierFromPriceId(priceId);
    if (!tier) {
      console.error(`[Webhook] Unknown price ID: ${priceId}`);
      await logPaymentEvent(eventId, "checkout.session.completed", "failed", {
        stripeCustomerId,
        priceId,
        errorMessage: "Unknown price ID",
      });
      return;
    }

    // Update user subscription
    await updateUserSubscription(user.id, {
      stripeCustomerId,
      subscriptionStatus: "active",
      priceId,
      subscriptionTier: tier,
      consultationCount: 0, // Reset count on new subscription
    });

    console.log(`[Webhook] User ${user.id} subscription updated to ${tier}`);
    await logPaymentEvent(eventId, "checkout.session.completed", "success", {
      userId: user.id,
      stripeCustomerId,
      priceId,
      productId,
      planType: tier,
      amount: session.amount_total ? session.amount_total / 100 : undefined,
      currency: session.currency ?? undefined,
    });
  } catch (error: any) {
    console.error("[Webhook] Error processing checkout session:", error.message);
    await logPaymentEvent(eventId, "checkout.session.completed", "failed", {
      stripeCustomerId,
      priceId,
      errorMessage: error.message,
    });
  }
}

// Handle customer.subscription.created
async function handleSubscriptionCreated(subscription: Stripe.Subscription, eventId: string) {
  const stripeCustomerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;

  if (!stripeCustomerId || !priceId) {
    console.error("[Webhook] Missing customer or price in subscription");
    await logPaymentEvent(eventId, "customer.subscription.created", "failed", {
      errorMessage: "Missing customer or price",
    });
    return;
  }

  try {
    const user = await getUserByStripeCustomerId(stripeCustomerId);
    if (!user) {
      console.error(`[Webhook] User not found for customer ${stripeCustomerId}`);
      await logPaymentEvent(eventId, "customer.subscription.created", "failed", {
        stripeCustomerId,
        errorMessage: "User not found",
      });
      return;
    }

    const tier = getTierFromPriceId(priceId);
    if (!tier) {
      console.error(`[Webhook] Unknown price ID: ${priceId}`);
      await logPaymentEvent(eventId, "customer.subscription.created", "failed", {
        stripeCustomerId,
        priceId,
        errorMessage: "Unknown price ID",
      });
      return;
    }

    await updateUserSubscription(user.id, {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: "active",
      priceId,
      subscriptionTier: tier,
      consultationCount: 0,
    });

    console.log(`[Webhook] User ${user.id} subscription created: ${tier}`);
    await logPaymentEvent(eventId, "customer.subscription.created", "success", {
      userId: user.id,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      priceId,
      planType: tier,
    });
  } catch (error: any) {
    console.error("[Webhook] Error processing subscription created:", error.message);
    await logPaymentEvent(eventId, "customer.subscription.created", "failed", {
      stripeCustomerId,
      priceId,
      errorMessage: error.message,
    });
  }
}

// Handle customer.subscription.updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string) {
  const stripeCustomerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;

  if (!stripeCustomerId || !priceId) {
    console.error("[Webhook] Missing customer or price in subscription update");
    await logPaymentEvent(eventId, "customer.subscription.updated", "failed", {
      errorMessage: "Missing customer or price",
    });
    return;
  }

  try {
    const user = await getUserByStripeCustomerId(stripeCustomerId);
    if (!user) {
      console.error(`[Webhook] User not found for customer ${stripeCustomerId}`);
      await logPaymentEvent(eventId, "customer.subscription.updated", "failed", {
        stripeCustomerId,
        errorMessage: "User not found",
      });
      return;
    }

    const tier = getTierFromPriceId(priceId);
    if (!tier) {
      console.error(`[Webhook] Unknown price ID: ${priceId}`);
      await logPaymentEvent(eventId, "customer.subscription.updated", "failed", {
        stripeCustomerId,
        priceId,
        errorMessage: "Unknown price ID",
      });
      return;
    }

    await updateUserSubscription(user.id, {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: "active",
      priceId,
      subscriptionTier: tier,
    });

    console.log(`[Webhook] User ${user.id} subscription updated to ${tier}`);
    await logPaymentEvent(eventId, "customer.subscription.updated", "success", {
      userId: user.id,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      priceId,
      planType: tier,
    });
  } catch (error: any) {
    console.error("[Webhook] Error processing subscription updated:", error.message);
    await logPaymentEvent(eventId, "customer.subscription.updated", "failed", {
      stripeCustomerId,
      priceId,
      errorMessage: error.message,
    });
  }
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
  const stripeCustomerId = subscription.customer as string;

  if (!stripeCustomerId) {
    console.error("[Webhook] Missing customer in subscription deletion");
    await logPaymentEvent(eventId, "customer.subscription.deleted", "failed", {
      errorMessage: "Missing customer",
    });
    return;
  }

  try {
    const user = await getUserByStripeCustomerId(stripeCustomerId);
    if (!user) {
      console.error(`[Webhook] User not found for customer ${stripeCustomerId}`);
      await logPaymentEvent(eventId, "customer.subscription.deleted", "failed", {
        stripeCustomerId,
        errorMessage: "User not found",
      });
      return;
    }

    // Cancel subscription
    await updateUserSubscription(user.id, {
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      priceId: null,
      subscriptionEndDate: null,
    });
    
    // Also exhaust trial by setting consultation count to max
    if (supabase) {
      // @ts-ignore - Supabase schema mismatch during migration
      await supabase
        .from("Users")
        .update({ consultationCount: 7 })
        .eq("id", user.id);
    }

    console.log(`[Webhook] User ${user.id} subscription canceled - trial EXHAUSTED, must resubscribe`);

    await logPaymentEvent(eventId, "subscription.deleted", "success", {
      userId: user.id,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    });
  } catch (error: any) {
    console.error("[Webhook] Error processing subscription deleted:", error.message);
    await logPaymentEvent(eventId, "subscription.deleted", "failed", {
      stripeCustomerId,
      errorMessage: error.message,
    });
  }
}

// Handle invoice.paid
async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  const stripeCustomerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string;

  if (!stripeCustomerId) {
    console.error("[Webhook] Missing customer in invoice");
    await logPaymentEvent(eventId, "invoice.paid", "failed", {
      errorMessage: "Missing customer",
    });
    return;
  }

  try {
    const user = await getUserByStripeCustomerId(stripeCustomerId);
    if (!user) {
      console.error(`[Webhook] User not found for customer ${stripeCustomerId}`);
      await logPaymentEvent(eventId, "invoice.paid", "failed", {
        stripeCustomerId,
        errorMessage: "User not found",
      });
      return;
    }

    // Reset consultation count on invoice paid (monthly reset)
    await updateUserSubscription(user.id, {
      consultationCount: 0,
    });

    console.log(`[Webhook] User ${user.id} invoice paid - consultation count reset`);
    await logPaymentEvent(eventId, "invoice.paid", "success", {
      userId: user.id,
      stripeCustomerId,
      amount: invoice.total ? invoice.total / 100 : undefined,
      currency: invoice.currency,
    });
  } catch (error: any) {
    console.error("[Webhook] Error processing invoice paid:", error.message);
    await logPaymentEvent(eventId, "invoice.paid", "failed", {
      stripeCustomerId,
      errorMessage: error.message,
    });
  }
}

// Main webhook handler
router.post("/", async (req: Request, res: Response) => {
  console.log("[Webhook] Received webhook request");
  
  if (!isStripeConfigured()) {
    console.warn("[Webhook] Stripe not configured, skipping webhook");
    return res.status(200).json({ received: true });
  }

  let event: Stripe.Event;

  try {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    
    if (!sig) {
      console.error("[Webhook] Missing stripe-signature header");
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    event = stripe!.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`[Webhook] Event verified: ${event.type} (${event.id})`);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    console.error("[Webhook] Headers:", JSON.stringify({
      'content-type': req.headers['content-type'],
      'stripe-signature': req.headers['stripe-signature'] ? 'present' : 'missing',
    }));
    console.error("[Webhook] Body type:", typeof req.body, "isBuffer:", Buffer.isBuffer(req.body));
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventId = event.id;

  // ⚠️ CRITICAL: Handle test events for webhook verification
  if (eventId.startsWith('evt_test_')) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  // Check idempotency
  try {
    if (await isEventProcessed(eventId)) {
      console.log(`[Webhook] Event ${eventId} already processed (duplicate)`);
      await logPaymentEvent(eventId, event.type, "duplicate", {});
      return res.status(200).json({ received: true });
    }
  } catch (err: any) {
    // Don't fail the webhook if idempotency check fails
    console.warn(`[Webhook] Idempotency check failed, proceeding: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, eventId);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, eventId);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, eventId);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, eventId);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, eventId);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        try {
          await logPaymentEvent(eventId, event.type, "ignored", {});
        } catch {
          // Don't fail for unhandled events
        }
    }

    console.log(`[Webhook] Event ${eventId} (${event.type}) processed successfully`);
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`[Webhook] Error processing event ${eventId}:`, error.message);
    console.error("[Webhook] Stack:", error.stack);
    // Still return 200 to prevent Stripe from retrying indefinitely
    // The error is logged and can be investigated
    return res.status(200).json({ received: true, error: "Processing error logged" });
  }
});

export default router;
