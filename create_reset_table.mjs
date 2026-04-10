import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Check if table already exists by trying to query it
const { error: checkError } = await supabase
  .from("Password_reset_tokens")
  .select("id")
  .limit(1);

if (!checkError) {
  console.log("Table Password_reset_tokens already exists!");
  process.exit(0);
}

// Table doesn't exist - we need to create it via SQL
// Since Supabase anon key can't run DDL, we'll use the REST API approach
// Instead, we'll create the table structure using Supabase insert (it will fail but that's expected)
console.log("Table Password_reset_tokens does not exist yet.");
console.log("Please create it via the Supabase Dashboard SQL Editor with:");
console.log(`
CREATE TABLE IF NOT EXISTS "Password_reset_tokens" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "token" VARCHAR(255) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "used" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reset_token ON "Password_reset_tokens" ("token");
CREATE INDEX idx_reset_email ON "Password_reset_tokens" ("email");
`);

// Try to create it by inserting and seeing what happens
const testInsert = await supabase.from("Password_reset_tokens").insert({
  id: 1,
  userId: 0,
  email: "test@test.com",
  token: "test_token_delete_me",
  expiresAt: new Date().toISOString(),
  used: false,
});

if (testInsert.error) {
  console.log("\nInsert test result:", testInsert.error.message);
  console.log("\nYou need to create the table manually in Supabase Dashboard.");
} else {
  console.log("Table was auto-created! Cleaning up test row...");
  await supabase.from("Password_reset_tokens").delete().eq("token", "test_token_delete_me");
  console.log("Done!");
}
