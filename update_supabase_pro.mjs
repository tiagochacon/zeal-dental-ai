import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// First, find the user
const { data: user, error: findError } = await supabase
  .from('Users')
  .select('id, email, name, subscriptionTier, subscriptionStatus, priceId, consultationCount, trialEndsAt, stripeCustomerId')
  .eq('email', 'filipepcm89@gmail.com')
  .maybeSingle();

if (findError) {
  console.error('❌ Erro ao buscar:', findError.message);
  process.exit(1);
}

if (!user) {
  console.log('❌ Usuário não encontrado no Supabase');
  process.exit(1);
}

console.log('📊 Status ANTES:');
console.log(`  Email: ${user.email}`);
console.log(`  Nome: ${user.name}`);
console.log(`  Tier: ${user.subscriptionTier}`);
console.log(`  Status: ${user.subscriptionStatus}`);
console.log(`  Price ID: ${user.priceId}`);
console.log(`  Consultas: ${user.consultationCount}`);
console.log(`  Trial Ends At: ${user.trialEndsAt}`);
console.log(`  Stripe Customer ID: ${user.stripeCustomerId}`);
console.log('');

// Update to PRO
const { data: updated, error: updateError } = await supabase
  .from('Users')
  .update({
    subscriptionTier: 'pro',
    subscriptionStatus: 'active',
    priceId: 'price_1SuYhvJBQOFbtGZhu5hcAhqH',
    consultationCount: 0,
    consultationCountResetAt: new Date().toISOString(),
  })
  .eq('email', 'filipepcm89@gmail.com')
  .select('id, email, name, subscriptionTier, subscriptionStatus, priceId, consultationCount')
  .single();

if (updateError) {
  console.error('❌ Erro ao atualizar:', updateError.message);
  process.exit(1);
}

console.log('✅ Status DEPOIS:');
console.log(`  Email: ${updated.email}`);
console.log(`  Nome: ${updated.name}`);
console.log(`  Tier: ${updated.subscriptionTier}`);
console.log(`  Status: ${updated.subscriptionStatus}`);
console.log(`  Price ID: ${updated.priceId}`);
console.log(`  Consultas: ${updated.consultationCount}`);
