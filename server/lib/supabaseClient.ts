import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail-fast: server should not run without Supabase configured.
  // This produces a clear startup error instead of a cryptic runtime crash
  // when code tries to call .from() on a null client.
  throw new Error(
    "[Supabase] SUPABASE_URL and SUPABASE_ANON_KEY are required environment variables.\n" +
    "→ In Manus: add them via Settings → Secrets\n" +
    "→ In Railway/Render: add them via Environment Variables\n" +
    "→ Locally: add them to your .env file"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

console.log("[Supabase] Client initialized for:", supabaseUrl.replace(/https?:\/\//, "").split(".")[0] + ".supabase.co");
