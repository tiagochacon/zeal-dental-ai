/**
 * Job para resetar consultation_count dos usu\u00e1rios no ciclo de billing
 * Este job deve ser executado diariamente (idealmente à meia-noite UTC)
 * 
 * Implementação: Chamar esta função via cron job ou webhook
 * Exemplo: node -e "require('./resetConsultationCount').resetMonthlyConsultationCounts()"
 */

import { supabase } from "../lib/supabaseClient";

export async function resetMonthlyConsultationCounts() {
  try {
    console.log("[Reset Job] Starting monthly consultation count reset...");

    const now = new Date();

    const { data: usersToCheck, error } = await supabase
      .from("Users")
      .select("id, consultationCountResetAt")
      .lte("consultationCountResetAt", now.toISOString());

    if (error) {
      console.error("[Reset Job] Error fetching users:", error.message);
      return;
    }

    console.log(`[Reset Job] Found ${(usersToCheck ?? []).length} users to check`);

    let resetCount = 0;
    for (const user of usersToCheck ?? []) {
      const resetDate = new Date(user.consultationCountResetAt);
      const nextResetDate = new Date(resetDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      if (now >= nextResetDate) {
        await supabase
          .from("Users")
          .update({ consultationCount: 0, consultationCountResetAt: now.toISOString() })
          .eq("id", user.id);

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
