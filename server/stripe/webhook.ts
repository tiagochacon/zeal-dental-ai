import { Request, Response, Router } from "express";
import { stripe, isStripeConfigured } from "./stripe";
import { 
  getUserByStripeCustomerId, 
  updateUserByStripeCustomerId,
  updateUserSubscription,
  getUserById
} from "../db";
import Stripe from "stripe";

const router = Router();

// Stripe webhook endpoint
// IMPORTANT: This must be registered BEFORE express.json() middleware
router.post(
  "/api/stripe/webhook",
  async (req: Request, res: Response) => {
    if (!stripe || !isStripeConfigured()) {
      console.log("[Webhook] Stripe not configured, ignoring webhook");
      return res.status(400).json({ error: "Stripe not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).json({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Webhook] Signature verification failed: ${message}`);
      return res.status(400).json({ error: `Webhook Error: ${message}` });
    }

    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(session);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(subscription);
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(invoice);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailed(invoice);
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Webhook] Error processing event: ${message}`);
      res.status(500).json({ error: message });
    }
  }
);

// Price IDs for plan identification
// These should match the Stripe Payment Links products
const PLAN_PRICE_IDS = {
  // Basic plan price IDs (from Stripe Payment Link)
  basic: [
    'price_basic', // placeholder - will be populated from checkout session
  ],
  // Pro plan price IDs (from Stripe Payment Link)
  pro: [
    'price_pro', // placeholder - will be populated from checkout session
  ],
};

// Determine subscription tier from price ID or product metadata
function determineTierFromSession(session: Stripe.Checkout.Session): 'basic' | 'pro' {
  // Check metadata first (most reliable)
  const tierFromMetadata = session.metadata?.plan_tier || session.metadata?.tier;
  if (tierFromMetadata === 'basic' || tierFromMetadata === 'pro') {
    return tierFromMetadata;
  }
  
  // Check amount to determine plan
  // Basic: R$ 99.90 = 9990 cents
  // Pro: R$ 199.90 = 19990 cents
  const amountTotal = session.amount_total || 0;
  
  // Pro plan is ~R$ 199.90 (19990 cents) or more
  if (amountTotal >= 15000) {
    return 'pro';
  }
  
  // Default to basic for lower amounts
  return 'basic';
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Webhook] Checkout completed: ${session.id}`);
  console.log(`[Webhook] Session details:`, {
    customer: session.customer,
    subscription: session.subscription,
    amount_total: session.amount_total,
    metadata: session.metadata,
    client_reference_id: session.client_reference_id,
    customer_email: session.customer_email,
  });
  
  const userId = session.metadata?.user_id || session.client_reference_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email || session.metadata?.customer_email;

  // Determine which plan was purchased
  const subscriptionTier = determineTierFromSession(session);
  console.log(`[Webhook] Determined subscription tier: ${subscriptionTier}`);

  // If we have userId, update directly
  if (userId) {
    await updateUserSubscription(parseInt(userId), {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      subscriptionTier: subscriptionTier,
    });
    console.log(`[Webhook] User ${userId} subscription activated with tier: ${subscriptionTier}`);
    return;
  }

  // If no userId but we have customer email, try to find user by email
  if (customerEmail) {
    const { getUserByEmail } = await import("../db");
    const user = await getUserByEmail(customerEmail);
    
    if (user) {
      await updateUserSubscription(user.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        subscriptionTier: subscriptionTier,
      });
      console.log(`[Webhook] User ${user.id} (by email: ${customerEmail}) subscription activated with tier: ${subscriptionTier}`);
      return;
    }
  }

  // If no userId and no matching email, log warning but don't fail
  console.warn(`[Webhook] No user found for checkout session. Customer: ${customerId}, Email: ${customerEmail}`);
  console.warn(`[Webhook] User will need to be linked manually or on next login`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Subscription updated: ${subscription.id}`);
  
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

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
  const priceId = subscription.items.data[0]?.price.id || null;
  // @ts-ignore - current_period_end exists in Stripe API response
  const periodEnd = (subscription as any).current_period_end;
  const endDate = periodEnd 
    ? new Date(periodEnd * 1000) 
    : null;

  await updateUserByStripeCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    priceId,
    subscriptionEndDate: endDate,
  });

  console.log(`[Webhook] User ${user.id} subscription status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
  
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  // Revoke access: set status to canceled and tier back to trial
  await updateUserSubscription(user.id, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    subscriptionTier: "trial", // Rebaixar para trial (acesso limitado)
    priceId: null,
    subscriptionEndDate: null,
  });

  console.log(`[Webhook] User ${user.id} subscription canceled - downgraded to trial tier`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log(`[Webhook] Invoice paid: ${invoice.id}`);
  
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  // Reset consultation count on billing cycle renewal
  // Only reset if this is a subscription invoice (not a one-time payment)
  // @ts-ignore - subscription exists in Stripe API response
  if ((invoice as any).subscription) {
    const { resetConsultationCount } = await import("../db");
    await resetConsultationCount(user.id);
    console.log(`[Webhook] User ${user.id} consultation count reset for new billing cycle`);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Webhook] Payment failed for invoice: ${invoice.id}`);
  
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  // Mark as past_due - user still has access but payment is pending
  // After multiple failures, Stripe will send customer.subscription.deleted
  await updateUserSubscription(user.id, {
    subscriptionStatus: "past_due",
  });

  console.log(`[Webhook] User ${user.id} marked as past_due - payment failed`);
  
  // TODO: Optionally send notification to user about failed payment
}

export default router;
