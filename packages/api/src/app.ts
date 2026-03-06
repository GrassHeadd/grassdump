import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { db } from "@repo/db";
import { appRouter } from "./routes";
import { getDevUser } from "./auth";
import { startCronJobs } from "./jobs";
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

// Start background cron jobs (reminders, digest, stale commitment scan)
startCronJobs();

export { app };
