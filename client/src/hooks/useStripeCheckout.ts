import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Stripe Price IDs — must match server/stripe/products.ts
 */
export const STRIPE_PRICE_IDS = {
  BASIC: "price_1SuYhvJBQOFbtGZhL4AVyGqb",
  PRO: "price_1SuYhvJBQOFbtGZhu5hcAhqH",
} as const;

export type StripePlan = "basic" | "pro";

/**
 * Centralised hook that calls the backend `createCheckoutSession` tRPC
 * mutation and redirects the user to the Stripe-hosted checkout page.
 *
 * Replaces every occurrence of static Payment Links (`buy.stripe.com/…`)
 * and `window.open(…, "_blank")` across the codebase.
 *
 * Benefits:
 *  - `window.location.href` is never blocked by popup blockers
 *  - Stripe Checkout Session includes `metadata.user_id` so the webhook
 *    can reliably associate the payment with the correct user
 */
export function useStripeCheckout() {
  const [checkoutPlan, setCheckoutPlan] = useState<StripePlan | null>(null);

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("Erro ao criar sessão de checkout. Tente novamente.");
        setCheckoutPlan(null);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar checkout. Tente novamente.");
      setCheckoutPlan(null);
    },
  });

  /**
   * Start a Stripe Checkout Session for the given plan.
   * The UI should show a loading state while `isLoading` is true.
   */
  const startCheckout = (plan: StripePlan) => {
    const priceId = plan === "basic" ? STRIPE_PRICE_IDS.BASIC : STRIPE_PRICE_IDS.PRO;
    setCheckoutPlan(plan);
    toast.info("Preparando checkout seguro...");
    createCheckout.mutate({ priceId });
  };

  return {
    startCheckout,
    /** Which plan is currently being checked out (null if idle) */
    checkoutPlan,
    /** True while the mutation is in-flight */
    isLoading: createCheckout.isPending,
  };
}
