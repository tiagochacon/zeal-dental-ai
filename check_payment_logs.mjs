import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('Payment_logs')
  .select('*')
  .eq('userId', 2730042)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error);
} else {
  console.log(JSON.stringify(data, null, 2));
}
