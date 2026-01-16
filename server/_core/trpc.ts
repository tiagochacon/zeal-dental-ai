import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG, SUBSCRIPTION_REQUIRED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Middleware that requires an active subscription.
 * Use this for premium features like AI transcription and SOAP note generation.
 */
const requireSubscription = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Allow admins to bypass subscription check
  if (ctx.user.role === 'admin') {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // Check if user has active subscription
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(ctx.user.subscriptionStatus || '')) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: SUBSCRIPTION_REQUIRED_ERR_MSG 
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedSubscriptionProcedure = t.procedure.use(requireSubscription);
