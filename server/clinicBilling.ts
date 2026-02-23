/**
 * Clinic Billing Helper
 * 
 * When a CRC or Dentista belongs to a clinic, their access is governed
 * by the gestor's (clinic owner's) subscription, not their own.
 * 
 * This module provides helpers to resolve the "effective user" for billing checks.
 */

import { getDb } from "./db";
import { users, clinics } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "../drizzle/schema";

/**
 * Get the gestor (clinic owner) for a given clinic ID.
 * Returns the full User object of the gestor.
 */
export async function getClinicGestor(clinicId: number): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;

  // Find the clinic to get ownerId
  const clinic = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  if (!clinic.length) return null;

  // Find the owner user
  const owner = await db.select().from(users).where(eq(users.id, clinic[0].ownerId)).limit(1);
  if (!owner.length) return null;

  return owner[0];
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
  // If user belongs to a clinic as CRC or Dentista, use the gestor's billing
  if (user.clinicId && (user.clinicRole === 'crc' || user.clinicRole === 'dentista')) {
    const gestor = await getClinicGestor(user.clinicId);
    if (gestor) {
      return gestor;
    }
  }
  
  // Default: use the user's own billing
  return user;
}

/**
 * Increment consultation count on the gestor (clinic owner) when a dentist
 * in the clinic creates a consultation.
 */
export async function incrementClinicConsultationCount(user: User): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Determine whose count to increment
  let targetUserId = user.id;
  
  if (user.clinicId && (user.clinicRole === 'crc' || user.clinicRole === 'dentista')) {
    const gestor = await getClinicGestor(user.clinicId);
    if (gestor) {
      targetUserId = gestor.id;
    }
  }

  // Get current user data
  const targetUser = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!targetUser.length) throw new Error("Target user not found");

  const now = new Date();
  const lastReset = targetUser[0].consultationCountResetAt;
  const isNewMonth = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();

  if (isNewMonth) {
    // Reset count for new month
    await db.update(users).set({
      consultationCount: 1,
      consultationCountResetAt: now,
    }).where(eq(users.id, targetUserId));
  } else {
    // Increment count
    await db.update(users).set({
      consultationCount: targetUser[0].consultationCount + 1,
    }).where(eq(users.id, targetUserId));
  }
}
