/**
 * Job para resetar consultation_count dos usuários no ciclo de billing
 * Este job deve ser executado diariamente (idealmente à meia-noite UTC)
 * 
 * Implementação: Chamar esta função via cron job ou webhook
 * Exemplo: node -e "require('./resetConsultationCount').resetMonthlyConsultationCounts()"
 */

import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, lte } from "drizzle-orm";

export async function resetMonthlyConsultationCounts() {
  const db = await getDb();
  if (!db) {
    console.error("[Reset Job] Database not available");
    return;
  }

  try {
    console.log("[Reset Job] Starting monthly consultation count reset...");

    // Get all users with consultation_count > 0 and reset date in the past
    const now = new Date();
    
    // Find users whose reset date is today or earlier
    const usersToReset = await db
      .select()
      .from(users)
      .where(lte(users.consultationCountResetAt, now));

    console.log(`[Reset Job] Found ${usersToReset.length} users to reset`);

    // Reset consultation count for each user
    let resetCount = 0;
    for (const user of usersToReset) {
      // Only reset if the reset date has passed (monthly cycle)
      const resetDate = new Date(user.consultationCountResetAt);
      const nextResetDate = new Date(resetDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      if (now >= nextResetDate) {
        await db.update(users)
          .set({
            consultationCount: 0,
            consultationCountResetAt: now,
          })
          .where(eq(users.id, user.id));

        resetCount++;
        console.log(`[Reset Job] Reset consultation count for user ${user.id}`);
      }
    }

    console.log(`[Reset Job] Successfully reset ${resetCount} users`);
    return { success: true, resetCount };
  } catch (error) {
    console.error("[Reset Job] Error resetting consultation counts:", error);
    throw error;
  }
}

// Export for use in cron jobs or scheduled tasks
export default resetMonthlyConsultationCounts;
