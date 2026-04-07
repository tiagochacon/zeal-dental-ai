import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// 1. Get the user
const { data: user } = await supabase
  .from('Users')
  .select('id, email, name, subscriptionTier, subscriptionStatus, priceId, clinicId, clinicRole, role, trialEndsAt, trialStartedAt, consultationCount')
  .eq('email', 'filipepcm89@gmail.com')
  .maybeSingle();

console.log('=== USUÁRIO ===');
console.log(JSON.stringify(user, null, 2));

if (user?.clinicId) {
  // 2. Get the clinic
  const { data: clinic } = await supabase
    .from('Clinics')
    .select('id, name, ownerId')
    .eq('id', user.clinicId)
    .maybeSingle();
  
  console.log('\n=== CLÍNICA ===');
  console.log(JSON.stringify(clinic, null, 2));
  
  if (clinic?.ownerId) {
    // 3. Get the owner (gestor)
    const { data: owner } = await supabase
      .from('Users')
      .select('id, email, name, subscriptionTier, subscriptionStatus, priceId, clinicRole, role')
      .eq('id', clinic.ownerId)
      .maybeSingle();
    
    console.log('\n=== OWNER (GESTOR) ===');
    console.log(JSON.stringify(owner, null, 2));
  }
}
