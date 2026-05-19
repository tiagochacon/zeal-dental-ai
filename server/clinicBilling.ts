/**
 * Clinic Billing Helper
 *
 * When a CRC or Dentista belongs to a clinic, their access is governed
 * by the gestor's (clinic owner's) subscription, not their own.
 *
 * This module provides helpers to resolve the "effective user" for billing checks.
 */

import { supabase } from "./lib/supabaseClient";
import type { User } from "../drizzle/schema";

function isActiveStatus(status: unknown): boolean {
  return status === "active" || status === "trialing";
}

export function isUnlimitedBillingUser(user: Pick<User, "role" | "subscriptionTier" | "priceId" | "email">): boolean {
  if (user.role === "admin") return true;
  if (user.subscriptionTier === "unlimited") return true;
  if (user.priceId === "unlimited") return true;
  return false;
}

function scoreGestorCandidate(user: User): number {
  if (isUnlimitedBillingUser(user)) return 100;
  if (isActiveStatus(user.subscriptionStatus)) return 70;
  if (user.subscriptionTier === "pro") return 60;
  if (user.subscriptionTier === "basic") return 50;
  if (user.subscriptionTier === "trial") return 40;
  return 10;
}

export function normalizeEffectiveBillingUser(user: User): User {
  if (!isUnlimitedBillingUser(user)) return user;
  return {
    ...user,
    subscriptionStatus: "active",
    subscriptionTier: "unlimited",
    priceId: user.priceId ?? "unlimited",
    trialStartedAt: null,
    trialEndsAt: null,
  } as User;
}

/**
 * Get the gestor (clinic owner) for a given clinic ID.
 * Returns the full User object of the gestor.
 */
export async function getClinicGestor(clinicId: number): Promise<User | null> {
  const { data: clinic, error: clinicError } = await supabase
    .from("Clinics")
    .select("ownerId")
    .eq("id", clinicId)
    .limit(1)
    .maybeSingle();
  if (!clinicError && clinic) {
    const { data: owner, error: ownerError } = await supabase
      .from("Users")
      .select("*")
      .eq("id", clinic.ownerId)
      .limit(1)
      .maybeSingle();
    if (!ownerError && owner) {
      return owner as User;
    }
  }

  // Fallback: resolve gestor directly by clinicId + clinicRole
  const { data: gestores, error: gestoresError } = await supabase
    .from("Users")
    .select("*")
    .eq("clinicId", clinicId)
    .eq("clinicRole", "gestor");
  if (gestoresError || !gestores || gestores.length === 0) return null;

  const ranked = (gestores as User[]).sort((a, b) => scoreGestorCandidate(b) - scoreGestorCandidate(a));
  return ranked[0] ?? null;
}

/**
 * Get the "effective user" for billing purposes.
 *
 * - If the user is a CRC or Dentista with a clinicId, return the gestor's User
 * - Otherwise, return the user themselves
 *
 * This allows CRC/Dentista to inherit the gestor's subscription limits.
 */
export async function getEffectiveBillingUser(user: User): Promise<User> {
  if (isUnlimitedBillingUser(user)) {
    return normalizeEffectiveBillingUser(user);
  }

  if (user.clinicRole === "gestor") {
    return normalizeEffectiveBillingUser(user);
  }

  if (user.clinicId && (user.clinicRole === "crc" || user.clinicRole === "dentista")) {
    const gestor = await getClinicGestor(user.clinicId);
    if (gestor) {
      return normalizeEffectiveBillingUser(gestor);
    }
  }
  return normalizeEffectiveBillingUser(user);
}

/**
 * Increment the consultation count for the "effective" user (gestor's count for clinic members).
 */
export async function incrementClinicConsultationCount(user: User): Promise<void> {
  const effectiveUser = await getEffectiveBillingUser(user);
  const { incrementConsultationCount } = await import("./db");
  await incrementConsultationCount(effectiveUser.id);
}
