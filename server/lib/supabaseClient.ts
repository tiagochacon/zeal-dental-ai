import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail-fast: server should not run without Supabase configured.
  // This produces a clear startup error instead of a cryptic runtime crash
  // when code tries to call .from() on a null client.
  throw new Error(
    "[Supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required environment variables.\n" +
    "→ Get the service_role key at: Supabase Dashboard → Project Settings → API\n" +
    "→ In Railway/Render: add them via Environment Variables\n" +
    "→ Locally: add them to your .env file"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log("[Supabase] Client initialized (service_role) for:", supabaseUrl.replace(/https?:\/\//, "").split(".")[0] + ".supabase.co");
