import bcrypt from "bcrypt";
import { supabase } from "./lib/supabaseClient";
import type { User } from "../drizzle/schema";

// NOTE: Existing admin users created before this change may not have clinicRole='gestor'.
// Run the following SQL manually to fix them:
// UPDATE users SET clinicRole='gestor' WHERE role='admin' AND clinicRole IS NULL;
// (Also create clinics for them via the ensureUserIsGestor function if needed)
const SALT_ROUNDS = 12;

// Admin emails with unlimited access
export const ADMIN_EMAILS = [
  "tiagosennachacon@gmail.com",
  "zealtecnologia@gmail.com",
  "victorodriguez2611@gmail.com",
];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
}): Promise<{ id: number; email: string; name: string; role: string; openId: string }> {
  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("email", data.email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error("Email já cadastrado");

  const passwordHash = await hashPassword(data.password);
  const isAdmin = isAdminEmail(data.email);
  const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const { data: row, error } = await supabase
    .from("users")
    .insert({
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      openId,
      loginMethod: "email",
      role: isAdmin ? "admin" : "user",
      subscriptionStatus: isAdmin ? "active" : "inactive",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const insertId = (row as { id: number }).id;

  if (isAdmin) {
    try {
      const { ensureUserIsGestor } = await import("./db");
      await ensureUserIsGestor(insertId);
    } catch (err) {
      console.warn(`[Auth] Could not auto-create clinic for admin user ${insertId}:`, err);
    }
  }

  return {
    id: insertId,
    email: data.email.toLowerCase(),
    name: data.name,
    role: isAdmin ? "admin" : "user",
    openId,
  };
}

export async function authenticateUser(email: string, password: string) {
  const { data: row, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Email ou senha incorretos");

  const user = row as User;

  if (!user.passwordHash) {
    throw new Error("Esta conta usa login social. Por favor, use o método de login original.");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) throw new Error("Email ou senha incorretos");

  await supabase
    .from("users")
    .update({ lastSignedIn: new Date().toISOString() })
    .eq("id", user.id);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    openId: user.openId || "",
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    consultationCount: user.consultationCount,
    priceId: user.priceId,
    clinicId: user.clinicId,
    clinicRole: user.clinicRole,
  };
}

export async function getUserByIdAuth(id: number) {
  const { data: row, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return row as User | null;
}
