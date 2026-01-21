import bcrypt from "bcrypt";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("Email já cadastrado");
  }

  const passwordHash = await hashPassword(data.password);
  const isAdmin = isAdminEmail(data.email);

  const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const result = await db.insert(users).values({
    email: data.email.toLowerCase(),
    passwordHash,
    name: data.name,
    openId,
    loginMethod: "email",
    role: isAdmin ? "admin" : "user",
    // Admins get active subscription status automatically
    subscriptionStatus: isAdmin ? "active" : "inactive",
  });

  const insertId = result[0].insertId;

  return {
    id: insertId,
    email: data.email.toLowerCase(),
    name: data.name,
    role: isAdmin ? "admin" : "user",
    openId,
  };
}

export async function authenticateUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Email ou senha incorretos");
  }

  const user = result[0];

  if (!user.passwordHash) {
    throw new Error("Esta conta usa login social. Por favor, use o método de login original.");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    throw new Error("Email ou senha incorretos");
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    openId: user.openId || '',
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    consultationCount: user.consultationCount,
    priceId: user.priceId,
  };
}

export async function getUserByIdAuth(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0] || null;
}
