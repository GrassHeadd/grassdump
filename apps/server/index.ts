import { app } from "@repo/api";

// Bun's built-in server — just point it at Hono's fetch handler.
// That's it. Hono handles all routing internally.
export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
