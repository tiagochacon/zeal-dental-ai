import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Database operations will fail."
  );
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error("[Supabase] Failed to initialize client:", error);
    supabase = null;
  }
}

export { supabase };
