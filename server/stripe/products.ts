/**
 * Stripe Products and Prices Configuration
 * 
 * IMPORTANT: These are the PRODUCTION IDs from Stripe Dashboard.
 * Do not modify unless the Stripe products change.
 */

// ============================================
// STRIPE PRODUCT & PRICE ID MAPPING
// ============================================

export const STRIPE_PRICE_IDS = {
  BASIC: "price_1SuYhvJBQOFbtGZhL4AVyGqb",
  PRO: "price_1SuYhvJBQOFbtGZhu5hcAhqH",
} as const;

export const STRIPE_PRODUCT_IDS = {
  BASIC: "prod_TsJKWnhkerrtD3",
  PRO: "prod_TsJKKhldI5j5h6",
} as const;

// ============================================
// PLAN CONFIGURATION
// ============================================

export type PlanTier = "trial" | "basic" | "pro" | "unlimited";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  priceId: string | null;
  productId: string | null;
  price: number;
  currency: string;
  consultationLimit: number | null; // null = unlimited
  features: string[];
  restrictedFeatures: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  trial: {
    tier: "trial",
    name: "Trial Gratuito",
    description: "Experimente o ZEAL por 7 dias",
    priceId: null,
    productId: null,
    price: 0,
    currency: "BRL",
    consultationLimit: 7,
    features: [
      "7 consultas gratuitas",
      "Transcrição automática",
      "Notas SOAP com IA",
      "Odontograma automático",
    ],
    restrictedFeatures: ["neurovendas"],
  },
  basic: {
    tier: "basic",
    name: "Zeal Basic",
    description: "Plano essencial para dentistas",
    priceId: STRIPE_PRICE_IDS.BASIC,
    productId: STRIPE_PRODUCT_IDS.BASIC,
    price: 99.90,
    currency: "BRL",
    consultationLimit: 20,
    features: [
      "20 consultas/mês",
      "Transcrição automática",
      "Notas SOAP com IA",
      "Odontograma automático",
      "Exportação de PDF",
    ],
    restrictedFeatures: ["neurovendas"],
  },
  pro: {
    tier: "pro",
    name: "Zeal PRO",
    description: "Acesso completo com Neurovendas",
    priceId: STRIPE_PRICE_IDS.PRO,
    productId: STRIPE_PRODUCT_IDS.PRO,
    price: 199.90,
    currency: "BRL",
    consultationLimit: 50,
    features: [
      "50 consultas/mês",
      "Transcrição automática",
      "Notas SOAP com IA",
      "Odontograma automático",
      "Exportação de PDF",
      "Análise de Neurovendas",
      "Perfil psicográfico do paciente",
      "Script de fechamento PARE",
      "Suporte prioritário",
    ],
    restrictedFeatures: [],
  },
  unlimited: {
    tier: "unlimited",
    name: "Zeal Unlimited",
    description: "Acesso ilimitado para clínicas",
    priceId: null,
    productId: null,
    price: 0,
    currency: "BRL",
    consultationLimit: null, // Unlimited
    features: [
      "Consultas ilimitadas",
      "Todos os recursos do PRO",
      "Suporte VIP",
    ],
    restrictedFeatures: [],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get plan tier from Stripe Price ID
 */
export function getTierFromPriceId(priceId: string): PlanTier | null {
  if (priceId === STRIPE_PRICE_IDS.BASIC) return "basic";
  if (priceId === STRIPE_PRICE_IDS.PRO) return "pro";
  return null;
}

/**
 * Get plan tier from Stripe Product ID
 */
export function getTierFromProductId(productId: string): PlanTier | null {
  if (productId === STRIPE_PRODUCT_IDS.BASIC) return "basic";
  if (productId === STRIPE_PRODUCT_IDS.PRO) return "pro";
  return null;
}

/**
 * Get plan tier from checkout amount (in cents)
 * Fallback method when Price/Product IDs are not available
 */
export function getTierFromAmount(amountCents: number): PlanTier {
  // Pro: R$ 199.90 = 19990 cents (allow some margin for discounts)
  if (amountCents >= 15000) return "pro";
  // Basic: R$ 99.90 = 9990 cents
  if (amountCents >= 5000) return "basic";
  // Below threshold = trial
  return "trial";
}

/**
 * Get plan configuration by tier
 */
export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLAN_CONFIGS[tier];
}

/**
 * Get plan configuration by Price ID
 */
export function getPlanConfigByPriceId(priceId: string): PlanConfig | null {
  const tier = getTierFromPriceId(priceId);
  return tier ? PLAN_CONFIGS[tier] : null;
}

/**
 * Check if a feature is restricted for a given tier
 */
export function isFeatureRestricted(tier: PlanTier, feature: string): boolean {
  const config = PLAN_CONFIGS[tier];
  return config.restrictedFeatures.includes(feature);
}

/**
 * Get consultation limit for a tier
 */
export function getConsultationLimit(tier: PlanTier): number | null {
  return PLAN_CONFIGS[tier].consultationLimit;
}

/**
 * Check if user has access to Neurovendas
 */
export function hasNeurovendasAccess(tier: PlanTier): boolean {
  return !isFeatureRestricted(tier, "neurovendas");
}
