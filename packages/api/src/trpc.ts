import { initTRPC, TRPCError } from "@trpc/server";
import type { Database } from "@repo/db";

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
// The "bag of stuff" every procedure can access.
// Created fresh for each incoming request.

export type Context = {
  db: Database;
  user: { id: string; timezone: string } | null;
};

// ------------------------------------------------------------------
// tRPC init
// ------------------------------------------------------------------
// initTRPC creates a builder scoped to our Context type.
// Everything we export (router, procedure) is wired to that context.

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// ------------------------------------------------------------------
// Protected procedure
// ------------------------------------------------------------------
// A procedure that requires a logged-in user.
// It uses middleware to check ctx.user before the handler runs.

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Pass the user through so handlers get a non-null type
  return next({ ctx: { ...ctx, user: ctx.user } });
});
