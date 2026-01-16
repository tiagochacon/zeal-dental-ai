import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

const PRODUCTS_CONFIG = {
  BASIC: {
    name: "ZEAL Básico",
    description: "Plano básico com até 20 consultas por mês",
    price_brl: 99.90,
    interval: "month",
    consultation_limit: 20,
  },
  PRO: {
    name: "ZEAL Pro",
    description: "Plano profissional com até 50 consultas por mês",
    price_brl: 199.90,
    interval: "month",
    consultation_limit: 50,
  },
};

async function initializeStripeProducts() {
  console.log("🚀 Inicializando produtos do Stripe...\n");

  const priceIds = {};

  for (const [key, config] of Object.entries(PRODUCTS_CONFIG)) {
    try {
      console.log(`📦 Criando produto: ${config.name}`);

      // Create product
      const product = await stripe.products.create({
        name: config.name,
        description: config.description,
        type: "service",
        metadata: {
          consultation_limit: config.consultation_limit.toString(),
          plan_key: key,
        },
      });

      console.log(`   ✓ Produto criado: ${product.id}`);

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(config.price_brl * 100), // Convert to cents
        currency: "brl",
        recurring: {
          interval: config.interval,
          interval_count: 1,
        },
        metadata: {
          plan_key: key,
        },
      });

      console.log(`   ✓ Preço criado: ${price.id}`);
      console.log(`   💰 Valor: R$ ${config.price_brl.toFixed(2)}/${config.interval}\n`);

      priceIds[key] = {
        product_id: product.id,
        price_id: price.id,
        name: config.name,
        price: config.price_brl,
        consultation_limit: config.consultation_limit,
      };
    } catch (error) {
      console.error(`❌ Erro ao criar produto ${key}:`, error.message);
      process.exit(1);
    }
  }

  // Save price IDs to .env.local
  const envContent = `# Stripe Products (Auto-generated)
VITE_STRIPE_PRICE_BASIC=${priceIds.BASIC.price_id}
VITE_STRIPE_PRICE_PRO=${priceIds.PRO.price_id}
VITE_STRIPE_PRODUCT_BASIC=${priceIds.BASIC.product_id}
VITE_STRIPE_PRODUCT_PRO=${priceIds.PRO.product_id}
`;

  const envPath = path.join(process.cwd(), ".env.local");
  fs.appendFileSync(envPath, "\n" + envContent);

  console.log("✅ Produtos do Stripe criados com sucesso!");
  console.log("\n📝 Price IDs salvos em .env.local:");
  console.log(`   BASIC:  ${priceIds.BASIC.price_id}`);
  console.log(`   PRO:    ${priceIds.PRO.price_id}`);
  console.log("\n⚠️  Reinicie o servidor para aplicar as novas variáveis de ambiente.");
}

initializeStripeProducts().catch((error) => {
  console.error("❌ Erro ao inicializar produtos:", error.message);
  process.exit(1);
});
