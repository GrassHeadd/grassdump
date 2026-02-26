import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { serve } from "inngest/hono";
import { db } from "@repo/db";
import { appRouter } from "./routes";
import { getDevUser } from "./auth";
import { inngest } from "./inngest/client";
import { functions } from "./inngest/functions";
import { telegramWebhook } from "./telegram/webhook";
import type { Context } from "./trpc";

const app = new Hono();

// Allow cross-origin requests (mobile app calling the API)
app.use("*", cors());

// Simple health check — useful for uptime monitoring and deploy verification
app.get("/health", (c) => c.json({ ok: true }));

// Mount tRPC — every request to /trpc/* gets handled by the tRPC router.
// createContext runs on each request to build the "bag of stuff" procedures need.
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: async (): Promise<Context> => ({
      db,
      user: await getDevUser(),
    }),
  }),
);

// Telegram webhook — Telegram POSTs here when someone messages the bot.
app.route("/webhook", telegramWebhook);

// Inngest endpoint — the Inngest dev server (or cloud in prod) calls this to
// discover our functions and trigger them when events fire.
app.on(
  ["GET", "POST", "PUT"],
  "/api/inngest",
  serve({ client: inngest, functions }),
);

export { app };
