# GrassDump MVP Implementation Plan

## Context

GrassDump is a personal AI agent — you message it via Telegram or a mobile app, it auto-classifies input as todo or dump, parses it, stores with pgvector embeddings, and proactively nudges you about forgotten commitments. The monorepo is fully scaffolded (Turborepo + Bun) but every source file is an empty placeholder. All npm deps are installed. We need to implement everything from scratch.

## Build Order

The dependency chain is: **core → db → ai → api → server → mobile**. Each layer depends on the ones before it. We build bottom-up so each layer can be tested independently before wiring.

---

## Phase 0: Housekeeping

### 0.1 Rename `apps/client/` → `apps/mobile/`
- `git mv apps/client apps/mobile`
- Update `apps/mobile/package.json`: name `"client"` → `"mobile"`

### 0.2 Create `.env.example` and `.env`
```
DATABASE_URL=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
```
User fills in `.env` with real values from Neon dashboard, OpenAI, BotFather.

### 0.3 Install missing dependencies
```bash
# packages/core
bun add chrono-node --cwd packages/core

# packages/api
bun add @repo/core@workspace:* @repo/db@workspace:* @repo/ai@workspace:* @hono/trpc-server inngest better-auth --cwd packages/api

# packages/ai
bun add @repo/core@workspace:* @repo/db@workspace:* --cwd packages/ai

# apps/server
bun add @repo/api@workspace:* @repo/db@workspace:* inngest dotenv --cwd apps/server

# apps/mobile
bun add @trpc/client @trpc/tanstack-react-query @tanstack/react-query expo-router expo-linking expo-constants expo-secure-store @repo/core@workspace:* --cwd apps/mobile
```

No Telegram bot framework — raw `fetch` to the Bot API, wrapped in a thin helper.

### 0.4 Create `packages/db/drizzle.config.ts`
Standard Drizzle Kit config pointing to `./src/schema.ts`, PostgreSQL dialect, `DATABASE_URL` from env.

---

## Phase 1: `packages/core` — Types, schemas, date parser

Zero external deps beyond zod + chrono-node. Every other package imports from here.

### Files to create:

**`packages/core/src/schemas.ts`** — Zod schemas + inferred types
- `noteTypeSchema` ('todo' | 'dump')
- `sourceSchema` ('telegram' | 'mobile' | 'web' | 'voice')
- `statusSchema` ('pending' | 'completed' | 'cancelled')
- `prioritySchema` ('low' | 'normal' | 'high')
- `nudgeStatusSchema` ('pending' | 'sent' | 'actioned' | 'snoozed' | 'dismissed')
- `noteSchema`, `userSchema`, `createNoteInputSchema`
- Exported types: `Note`, `User`, `CreateNoteInput`, etc.

**`packages/core/src/ai-schemas.ts`** — LLM response contract
- `parsedItemSchema` (summary, dueExpression, list, priority)
- `classificationResponseSchema` (type + items array)
- Shared between `@repo/ai` (sends request) and `@repo/api` (processes response)

**`packages/core/src/date-parser.ts`** — chrono-node wrapper
- `resolveDateExpression(expression, referenceDate, timezone) → Date | null`
- Handles "next tuesday", "in 3 days", "march 1st", etc.

**`packages/core/index.ts`** — barrel re-export

---

## Phase 2: `packages/db` — Schema, connection, queries

### Files to create:

**`packages/db/src/schema.ts`** — Drizzle schema
- `users` table: id, telegram_id, email, timezone, digest_enabled, digest_time, created_at
- `notes` table: id, user_id, raw_input, summary, type, source, status, list, due_at, priority, completed_at, tags, nudge_status, nudged_at, embedding (vector 1536), created_at, updated_at
- Custom `vector` type via `customType` from drizzle-orm/pg-core
- Indexes on the table (partial indexes + HNSW added via raw SQL migration)

**`packages/db/src/client.ts`** — Drizzle client
- postgres.js connection to Neon (SSL required)
- Export `db` and `Database` type

**`packages/db/src/queries.ts`** — Query functions
- User: `getOrCreateUserByTelegramId`, `findUserByEmail`, `createUser`
- Notes CRUD: `createNote`, `updateNote`, `getNoteById`
- Views: `getTodosDueToday`, `getOverdueTodos`, `getTodosUpcoming`, `getDumpFeed`, `getRecentDumps`
- Actions: `completeNote`, `uncompleteNote`, `cancelNote`
- Search: `semanticSearch` (raw SQL for `embedding <=> $vector`)
- Nudges: `getStaleUnprocessedDumps`, `updateNudgeStatus`
- Embeddings: `updateEmbedding`
- Lists: `getDistinctLists`

**`packages/db/index.ts`** — barrel re-export

### After creating schema:
1. Run `bunx drizzle-kit generate` from `packages/db/`
2. Manually add to migration: `CREATE EXTENSION IF NOT EXISTS vector;` + HNSW index + partial index WHERE clauses
3. Run `bunx drizzle-kit push` to apply to Neon

---

## Phase 3: `packages/ai` — LLM parsing, embeddings, commitment detection

### Files to create:

**`packages/ai/src/client.ts`** — OpenAI client init

**`packages/ai/src/classify.ts`** — Core classification function
- `classifyAndParse(rawInput: string) → ClassificationResponse`
- Uses gpt-4o-mini with OpenAI structured outputs (`response_format` with JSON schema)
- System prompt: classify todo/dump, extract multi-intent, return summary + dueExpression + list + priority
- Validates response with `classificationResponseSchema.parse()`

**`packages/ai/src/reparse.ts`** — Type flip re-parse
- `reparseAsType(rawInput, forcedType) → ClassificationResponse`
- Same as classify but forces the type in the prompt

**`packages/ai/src/embeddings.ts`** — Embedding generation
- `generateEmbedding(text: string) → number[]`
- Uses text-embedding-3-small (1536 dims)

**`packages/ai/src/commitment-detection.ts`** — Stale commitment scanner
- `detectCommitment(summary, rawInput) → { hasCommitment: boolean, reason: string }`
- LLM call: "Does this note contain an implicit commitment?"
- Uses gpt-4o-mini structured output

**`packages/ai/index.ts`** — barrel re-export

---

## Phase 4: `packages/api` — Routes, Telegram, Inngest, auth

The biggest package. Telegram bot logic lives here as route handlers.

### Files to create:

**`packages/api/src/auth.ts`** — Lightweight auth for MVP
- Telegram: lookup/create user by telegram_id from webhook payload
- Mobile: placeholder token-based auth (Better Auth wired properly later)
- MVP is single-user so keep this dead simple

**`packages/api/src/trpc.ts`** — tRPC init
- Context type: `{ db, user }`
- Export `router`, `publicProcedure`, `protectedProcedure` (auth guard)

**`packages/api/src/routes/notes.ts`** — tRPC note router
- `create` mutation: classify → resolve dates → save → trigger embedding job → return
- `today` query: overdue + due today + upcoming
- `dumpFeed` query: paginated chronological dumps
- `complete` / `uncomplete` / `cancel` mutations
- `update` mutation: edit fields, re-parse if type flipped, re-embed
- `search` query: generate query embedding → vector search → return with similarity
- `lists` query: distinct lists for user

**`packages/api/src/routes/index.ts`** — Combined app router
- Merges notesRouter
- Exports `AppRouter` type for mobile client

**`packages/api/src/telegram/api.ts`** — Telegram Bot API wrapper (raw fetch)
- `sendMessage`, `sendChatAction`, `editMessageText`, `answerCallbackQuery`, `setWebhook`
- Types for inline keyboards

**`packages/api/src/telegram/formatter.ts`** — Message formatting
- `formatTodoReply(notes)` → text + inline keyboard (Edit, Undo)
- `formatDumpReply(note)` → text + inline keyboard (Actually a task, Edit)
- `formatReminderMessage`, `formatNudgeMessage`, `formatSearchResults`

**`packages/api/src/telegram/webhook.ts`** — Webhook route (Hono)
- POST `/webhook/telegram`
- `handleTextMessage`: typing indicator → get/create user → classify → resolve dates → save → trigger embed → reply
- `handleCallbackQuery`: parse callback_data → undo/edit/flip/complete/dismiss → edit message
- Search detection: if message looks like a question, route to semantic search instead of capture

**`packages/api/src/inngest/client.ts`** — Inngest client
**`packages/api/src/inngest/functions.ts`** — Async jobs
- `generate-embedding`: triggered by `note/created` event, generates + saves embedding
- `daily-reminders`: hourly cron, checks per-user digest_time, sends batched Telegram reminder
- `stale-commitment-scan`: daily cron, finds old dumps, LLM checks for commitments, sends nudge

**`packages/api/src/app.ts`** — Main Hono app
- CORS middleware
- Health check route
- tRPC mounted at `/trpc/*`
- Telegram webhook mounted
- Inngest serve endpoint at `/api/inngest`

**`packages/api/index.ts`** — barrel (exports `app` and `AppRouter` type)

---

## Phase 5: `apps/server` — Entry point

**`apps/server/index.ts`** — Bun server for local dev
- Import `app` from `@repo/api`
- `export default { port: 3000, fetch: app.fetch }`

**`apps/server/src/vercel.ts`** — Vercel adapter for deployment

**`apps/server/vercel.json`** — Vercel config

---

## Phase 6: `apps/mobile` — Expo app

### Setup:
- Convert to Expo Router (file-based routing)
- Delete `App.tsx`, create `app/` directory
- Set up tRPC client + React Query providers

### Files to create:

**`apps/mobile/lib/trpc.ts`** — tRPC client
- httpBatchLink pointing to localhost:3000 or `EXPO_PUBLIC_API_URL`
- Export `TRPCProvider` and `useTRPC`

**`apps/mobile/app/_layout.tsx`** — Root layout
- QueryClientProvider + TRPCProvider wrapping Stack

**`apps/mobile/app/(tabs)/_layout.tsx`** — Tab navigator
- Tabs: Home, Todos, Dumps, Search

**`apps/mobile/app/(tabs)/index.tsx`** — Home screen
- Overdue (red) + due today + upcoming + recent dumps
- `trpc.notes.today.useQuery()`

**`apps/mobile/app/(tabs)/todos.tsx`** — All todos
- Tab filter: Today/Week/Month/All
- List filter

**`apps/mobile/app/(tabs)/dumps.tsx`** — Dump feed
- Chronological FlatList
- Tap to view, convert to todo

**`apps/mobile/app/(tabs)/search.tsx`** — Search
- Search bar + filter chips
- `trpc.notes.search.useQuery()`

**`apps/mobile/components/InputBar.tsx`** — Bottom input bar
- TextInput + send button
- `trpc.notes.create.mutate()`
- Spinner during processing

**`apps/mobile/components/PreviewCard.tsx`** — Auto-dismissing preview
- Slides up after capture
- Edit/Undo per item
- Auto-dismisses after ~5 seconds

---

## Phase 7: Integration & Testing

1. **Neon**: Verify database, run migrations, confirm pgvector enabled
2. **Telegram**: Create bot via BotFather, set webhook via ngrok tunnel
3. **E2E flow**: Start server → message bot → verify note saved → verify embedding → search → test mobile app
4. **Inngest**: Run `npx inngest-cli@latest dev` alongside server for async jobs

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| pgvector custom type in Drizzle | Fall back to raw SQL for embedding column if `customType` is finicky |
| OpenAI structured outputs + Zod v4 | Use `openai/helpers/zod` `zodResponseFormat` helper, or manually write JSON schema |
| tRPC v11 + Hono adapter compat | Verify `@hono/trpc-server` supports v11; fall back to `fetchRequestHandler` |
| `@repo/core` imported by Expo (Metro, not Bun) | No Bun-specific APIs in core — standard TS only |
| Zod v4 compat with tRPC/OpenAI | Zod v4 has `zod/v3` compat export if needed |
| Telegram webhook needs public URL locally | ngrok or cloudflared tunnel |
| Inngest needs dev server locally | `npx inngest-cli@latest dev` |
