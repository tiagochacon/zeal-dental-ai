import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Database operations will fail."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseKey ?? ""
);
