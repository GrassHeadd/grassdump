import { z } from "zod";
import {
  createNoteInputSchema,
  noteTypeSchema,
  statusSchema,
  prioritySchema,
} from "@repo/core";
import {
  captureNote,
  flipNoteType,
  search,
  getTodayView,
  getDumpFeed,
  getDistinctLists,
  completeNote,
  uncompleteNote,
  cancelNote,
  editNote,
} from "@repo/service";
import { router, protectedProcedure } from "../trpc";

// ------------------------------------------------------------------
// Notes router
// ------------------------------------------------------------------
// Every procedure here is protected (requires a logged-in user).
// The service layer does the heavy lifting — these are just the
// "doors" that validate input and call the right service function.

export const notesRouter = router({
  // ------------------------------------------------------------------
  // CREATE — classify raw input, resolve dates, save notes
  // ------------------------------------------------------------------
  create: protectedProcedure
    .input(createNoteInputSchema)
    .mutation(async ({ ctx, input }) => {
      return captureNote(
        ctx.user.id,
        input.rawInput,
        input.source,
        ctx.user.timezone,
      );
    }),

  // ------------------------------------------------------------------
  // TODAY — overdue + due today + upcoming + recent dumps
  // ------------------------------------------------------------------
  today: protectedProcedure.query(async ({ ctx }) => {
    return getTodayView(ctx.user.id);
  }),

  // ------------------------------------------------------------------
  // DUMP FEED — paginated chronological dumps
  // ------------------------------------------------------------------
  dumpFeed: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return getDumpFeed(ctx.user.id, input.limit);
    }),

  // ------------------------------------------------------------------
  // SEARCH — semantic vector search
  // ------------------------------------------------------------------
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      return search(ctx.user.id, input.query, input.limit);
    }),

  // ------------------------------------------------------------------
  // COMPLETE / UNCOMPLETE / CANCEL — toggle note status
  // ------------------------------------------------------------------
  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return completeNote(input.id);
    }),

  uncomplete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return uncompleteNote(input.id);
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return cancelNote(input.id);
    }),

  // ------------------------------------------------------------------
  // FLIP TYPE — re-parse as todo or dump
  // ------------------------------------------------------------------
  flipType: protectedProcedure
    .input(z.object({ id: z.string().uuid(), newType: noteTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      return flipNoteType(input.id, input.newType, ctx.user.timezone);
    }),

  // ------------------------------------------------------------------
  // EDIT — update note fields directly
  // ------------------------------------------------------------------
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        summary: z.string().optional(),
        type: noteTypeSchema.optional(),
        status: statusSchema.optional(),
        list: z.string().nullable().optional(),
        dueAt: z.coerce.date().nullable().optional(),
        priority: prioritySchema.nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return editNote(id, data);
    }),

  // ------------------------------------------------------------------
  // LISTS — distinct list names for the user
  // ------------------------------------------------------------------
  lists: protectedProcedure.query(async ({ ctx }) => {
    return getDistinctLists(ctx.user.id);
  }),
});
