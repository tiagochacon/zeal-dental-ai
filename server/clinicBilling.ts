// @ts-nocheck - Supabase schema mismatch during migration
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

/**
 * Get the gestor (clinic owner) for a given clinic ID.
 * Returns the full User object of the gestor.
 */
export async function getClinicGestor(clinicId: number): Promise<User | null> {
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("ownerId")
    .eq("id", clinicId)
    .limit(1)
    .maybeSingle();
  if (clinicError || !clinic) return null;

  const { data: owner, error: ownerError } = await supabase
    .from("users")
    .select("*")
    .eq("id", clinic.ownerId)
    .limit(1)
    .maybeSingle();
  if (ownerError || !owner) return null;

  return owner as User;
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
  if (user.clinicId && (user.clinicRole === "crc" || user.clinicRole === "dentista")) {
    const gestor = await getClinicGestor(user.clinicId);
    if (gestor) return gestor;
  }
  return user;
}

/**
 * Increment the consultation count for the "effective" user (gestor's count for clinic members).
 */
export async function incrementClinicConsultationCount(user: User): Promise<void> {
  const effectiveUser = await getEffectiveBillingUser(user);
  const { incrementConsultationCount } = await import("./db");
  await incrementConsultationCount(effectiveUser.id);
}
