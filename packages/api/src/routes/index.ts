import { router } from "../trpc";
import { notesRouter } from "./notes";

// ------------------------------------------------------------------
// App router
// ------------------------------------------------------------------
// Merges all sub-routers into one. This is what gets mounted on Hono
// and what the mobile app imports the TYPE of for end-to-end type safety.

export const appRouter = router({
  notes: notesRouter,
});

// The frontend imports this TYPE (not the actual code) to get autocomplete.
export type AppRouter = typeof appRouter;
