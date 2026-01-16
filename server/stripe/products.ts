/**
 * Stripe Products and Prices Configuration
 * 
 * Note: These are placeholder IDs. Replace with actual Stripe Price IDs
 * after creating products in the Stripe Dashboard.
 */

export const STRIPE_PRODUCTS = {
  // Monthly subscription plan
  MONTHLY: {
    name: "ZEAL Pro Mensal",
    description: "Acesso completo ao ZEAL com transcrição ilimitada e geração de notas SOAP",
    priceId: process.env.STRIPE_PRICE_MONTHLY || "price_monthly_placeholder",
    price: 99.90,
    currency: "BRL",
    interval: "month" as const,
    features: [
      "Transcrição de áudio ilimitada",
      "Geração automática de Nota SOAP",
      "Odontograma automático",
      "Exportação de PDF",
      "Suporte prioritário",
    ],
  },
  // Annual subscription plan (with discount)
  ANNUAL: {
    name: "ZEAL Pro Anual",
    description: "Acesso completo ao ZEAL com 2 meses grátis",
    priceId: process.env.STRIPE_PRICE_ANNUAL || "price_annual_placeholder",
    price: 999.00,
    currency: "BRL",
    interval: "year" as const,
    features: [
      "Tudo do plano mensal",
      "2 meses grátis (economia de R$ 199,80)",
      "Acesso antecipado a novos recursos",
      "Suporte VIP",
    ],
  },
} as const;

export type StripeProductKey = keyof typeof STRIPE_PRODUCTS;

export function getProductByPriceId(priceId: string) {
  return Object.values(STRIPE_PRODUCTS).find(p => p.priceId === priceId);
}
