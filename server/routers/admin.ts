import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { resetUserAccount } from "../db";
import { ENV } from "../_core/env";

export const adminRouter = router({
  resetAccount: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      adminPassword: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const adminPassword = ENV.adminPassword;

      if (ctx.user.role !== 'admin') {
        throw new Error('Acesso negado: apenas administradores');
      }

      if (input.adminPassword !== adminPassword) {
        throw new Error('Senha de admin inválida');
      }

      return await resetUserAccount(input.email);
    }),
});
