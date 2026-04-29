import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { stripe, isStripeConfigured } from "../stripe/stripe";
import { PLAN_CONFIGS } from "../stripe/products";
import { updateUserSubscription, getUserById } from "../db";

export const billingRouter = router({
  getPlanInfo: protectedProcedure.query(async ({ ctx }) => {
    const { getUserPlanInfo } = await import('../billing');
    const { getEffectiveBillingUser } = await import('../clinicBilling');
    const user = await getUserById(ctx.user.id);
    if (!user) throw new Error("Usuário não encontrado");
    const billingUser = await getEffectiveBillingUser(user);
    return getUserPlanInfo(billingUser);
  }),

  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const { startUserTrial, ensureUserIsGestor } = await import('../db');
    const { calculateTrialEndDate } = await import('../billing');

    const user = await getUserById(ctx.user.id);
    if (!user) throw new Error("Usuário não encontrado");

    if (user.trialStartedAt) {
      throw new Error("Seu período de trial já foi utilizado. Escolha um plano para continuar.");
    }
    if (user.subscriptionStatus === 'active') {
      throw new Error("Você já possui uma assinatura ativa.");
    }

    const trialEndDate = calculateTrialEndDate();
    await startUserTrial(ctx.user.id, trialEndDate);
    await ensureUserIsGestor(ctx.user.id);

    return { success: true, trialEndsAt: trialEndDate };
  }),
});

export const stripeRouter = router({
  getSubscriptionInfo: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new Error("Usuário não encontrado");

    const { getEffectiveBillingUser } = await import('../clinicBilling');
    const billingUser = await getEffectiveBillingUser(user);

    return {
      subscriptionStatus: billingUser.subscriptionStatus,
      priceId: billingUser.priceId,
      subscriptionEndDate: billingUser.subscriptionEndDate,
      plans: Object.entries(PLAN_CONFIGS)
        .filter(([_, config]) => config.priceId !== null)
        .map(([tier, config]) => ({
          key: tier,
          name: config.name,
          description: config.description,
          price: config.price,
          currency: config.currency,
          interval: "month" as const,
          features: config.features,
          priceId: config.priceId,
        })),
    };
  }),

  createCheckoutSession: protectedProcedure
    .input(z.object({
      priceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!stripe || !isStripeConfigured()) {
        throw new Error("Stripe não está configurado");
      }

      const user = await getUserById(ctx.user.id);
      if (!user) throw new Error("Usuário não encontrado");

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || undefined,
          metadata: {
            user_id: ctx.user.id.toString(),
          },
        });
        customerId = customer.id;
        await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
      }

      const origin = ctx.req.headers.origin || 'http://localhost:3000';
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        client_reference_id: ctx.user.id.toString(),
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: input.priceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/subscription?success=true`,
        cancel_url: `${origin}/subscription?canceled=true`,
        allow_promotion_codes: true,
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: user.email || '',
          customer_name: user.name || '',
        },
      });

      return { checkoutUrl: session.url };
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    if (!stripe || !isStripeConfigured()) {
      throw new Error("Stripe não está configurado");
    }

    const user = await getUserById(ctx.user.id);
    if (!user || !user.stripeCustomerId) {
      throw new Error("Nenhuma assinatura encontrada");
    }

    const origin = ctx.req.headers.origin || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/subscription`,
    });

    return { portalUrl: session.url };
  }),
});
