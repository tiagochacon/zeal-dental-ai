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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Webhook] Checkout completed: ${session.id}`);
  
  const userId = session.metadata?.user_id || session.client_reference_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error("[Webhook] No user_id in checkout session metadata");
    return;
  }

  // Update user with Stripe customer ID
  await updateUserSubscription(parseInt(userId), {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: "active",
  });

  console.log(`[Webhook] User ${userId} subscription activated`);
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

  await updateUserByStripeCustomerId(customerId, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    priceId: null,
    subscriptionEndDate: null,
  });

  console.log(`[Webhook] User ${user.id} subscription canceled`);
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

  await updateUserByStripeCustomerId(customerId, {
    subscriptionStatus: "past_due",
  });

  console.log(`[Webhook] User ${user.id} marked as past_due`);
}

export default router;
