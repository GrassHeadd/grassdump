# GrassDump

## One-liner
A personal AI agent you talk to like a friend — dump your thoughts via Telegram or the app, it figures out what's a task vs a note, manages your todos automatically, and nudges you when you're forgetting commitments.

## The core insight
People text themselves reminders because every todo app is too slow. GrassDump is as fast as texting yourself, except it actually does something with what you said.

**Capture is instant. Management is automatic. The system comes back to you.**

## How it works
You tell it things. That's it.

"call mom tuesday and buy eggs" → it creates two todos, sets the date, puts eggs in Groceries.

"that tiktok recruiter said follow up next week" → it stores it as a memory. Six days later, it messages you: "Hey, you mentioned following up with the TikTok recruiter. Want me to make that a task?"

You never have to organize anything. You never have to check a todo list and hope you remember. The system manages and comes back to you.

## Two internal types (not user-facing modes)

The user just talks. The AI classifies internally.

### Todos — actionable things
- "buy eggs" → todo
- "remind me to call the dentist" → todo
- "call mom tuesday and pick up groceries" → two todos (multi-intent)
- Auto-parsed: due dates, lists, priority
- Auto-managed: reminders, overdue nudges, digest

### Dumps — everything else
- "that recruiter said follow up next week" → dump
- "wifi password at the office is XYZ123" → dump
- "random thought: postgres vacuuming is interesting" → dump
- Stored with embedding for semantic search
- Scanned for implicit commitments → nudged later

The user never picks "todo mode" or "dump mode." They just talk. The preview shows what the AI decided, with a tap to flip if wrong.

## Channels

### Telegram bot
- Message the bot naturally, any time
- Auto-saved immediately — bot replies with what it parsed
- Tap "Edit" or "Undo" if the parse is wrong (disappears after a while)
- Reminders and proactive nudges arrive here
- Semantic search: just ask a question
- Best for: quickfire capture, getting nudged

### Mobile app (React Native + Expo)
- Input bar at bottom, always visible
- Type and send — auto-saved, parse preview shows as a dismissible card
- Today view, upcoming, dump feed, search
- Swipe to complete/reschedule
- Best for: browsing, managing, reviewing your day
- Expo web build gives you a web version for free (no separate web app)

### Desktop overlay (Phase 2)
- Global hotkey (e.g. Cmd+Shift+Space) → floating input appears over any app
- Type, hit enter, it captures and vanishes. Never leave what you're doing.
- Shows brief parse result (what the AI classified it as), then auto-dismisses
- Desktop notifications for reminders and nudges
- Capture only — for viewing/managing todos, open the web app (Expo web build)
- Built with Tauri (lightweight, native feel, tiny bundle)
- Best for: capturing thoughts while working on your computer without context switching

### Web app
- Expo web build — same codebase as mobile, runs in browser
- Full management: today view, todo list, dump feed, search
- Browser push notifications for reminders and nudges
- This IS the desktop management interface — no need for a separate desktop app with screens

### iOS Shortcut (Phase 2)
- Action Button → record voice → POST to API → Whisper transcribes → same pipeline
- Fastest possible capture: press button, speak, done

### All channels hit the same tRPC backend
One API, multiple clients. Demonstrates multi-client architecture.

## The capture flow

### Zero-tap happy path
The entire capture flow is optimized for speed. No confirmation step.

**Telegram:**
```
You:  "call mom tuesday and buy eggs"
Bot:  ✅ Saved 2 todos:
      1. Call mom — Due: Tue Feb 11
      2. Buy eggs — List: Groceries
      [✏️ Edit] [↩️ Undo]
```
If you do nothing, it's done. Tap Edit only if the AI got it wrong.

**Mobile app:**
1. Type in input bar → send
2. Items saved immediately
3. Dismissible preview card slides up showing what was parsed
4. Card has Edit/Undo per item, auto-dismisses after ~5 seconds
5. If multi-intent: preview shows all items, each with its own Edit/Undo

**Dumps auto-save too:**
```
You:  "that tiktok recruiter said to follow up next week"
Bot:  💭 Noted: "TikTok recruiter — follow up next week"
      [📋 Actually a task] [✏️ Edit]
```

### When the AI gets it wrong
- User taps "Actually a task" → re-parsed as todo (new LLM call with forced type=todo to extract due date, list, priority)
- User taps "Edit" → can modify summary, date, list, type
- User taps "Undo" → deleted

### Editing after creation
Todos and dumps are both editable after creation:
- Change summary, due date, list, priority
- On mobile: tap to open detail view, edit fields
- On Telegram: reply to the bot's saved message with corrections, or use /edit command
- Editing re-triggers embedding generation async

## Auto-management (the actual product)

Capture is table stakes. This is what makes GrassDump different from Apple Notes.

### Due date reminders
- Morning of (default) or configurable per-user
- Telegram message with one-tap actions: [✅ Done] [⏰ Tomorrow] [📅 Pick date]
- Batched — one "morning digest" message, not 5 separate pings

### Overdue nudges
- Daily reminder for anything past due
- Escalating tone based on days overdue:
  - Day 1: "Heads up — you have 2 overdue todos." (informational)
  - Day 3: "Still 2 overdue. Reschedule or complete?" (action prompt)
  - Day 7+: "These have been overdue for a week. Reschedule, complete, or cancel?" (includes cancel option)
- After day 7, frequency drops to every 3 days to avoid spam

### Stale commitment detection (the killer feature)
- Cron job scans dumps for implicit commitments
- Not just keyword matching — LLM call on flagged dumps to determine if there's an actionable commitment
- If commitment detected and no corresponding todo exists: nudge via Telegram
- "You mentioned following up with the TikTok recruiter 6 days ago. Want me to make that a task?"
- [✅ Yes] [⏰ Remind Later] [🚫 Dismiss]
- Dismissed = never nudged about this dump again

### Morning digest (optional)
- "Good morning. Here's your day: 3 todos due, 1 overdue, 1 stale commitment."
- Configurable: on/off, time, what to include

### Nudge tracking
Every nudge is tracked to avoid spam:
- `nudged_at` timestamp on the note
- `nudge_status`: 'pending' | 'sent' | 'actioned' | 'snoozed' | 'dismissed'
- Snoozed nudges re-trigger after the snooze period
- Dismissed nudges never come back

## Mobile app screens

### Home (default)
- Overdue todos (red banner if any)
- Due today
- Coming up (next 2-3 days)
- Recent dumps (last few, for context)
- Input bar at bottom, always visible

### All Todos
- Filterable by list, status, date range
- Tabs: Today / Week / Month / All
- Swipe right to complete, swipe left to reschedule

### Dumps
- Chronological feed
- Search bar with semantic search
- Tap to view full text, edit, or convert to todo

### Search
- Unified across todos and dumps
- Semantic vector search, not just keyword
- Filter chips: All / Todos / Dumps
- Results tagged with type indicators

## Database schema

### notes
```sql
CREATE TABLE notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  raw_input       text NOT NULL,
  summary         text,
  type            text NOT NULL CHECK (type IN ('todo', 'dump')),
  source          text NOT NULL CHECK (source IN ('telegram', 'mobile', 'web', 'desktop', 'voice')),
  status          text CHECK (status IN ('pending', 'completed', 'cancelled')),
  list            text,
  due_at          timestamptz,
  priority        text CHECK (priority IN ('low', 'normal', 'high')),
  completed_at    timestamptz,
  nudge_status    text CHECK (nudge_status IN ('pending', 'sent', 'actioned', 'snoozed', 'dismissed')),
  nudged_at       timestamptz,
  snooze_until    timestamptz,
  telegram_message_id bigint,
  embedding       vector(1536),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Today view: pending todos by due date
CREATE INDEX idx_notes_user_status_due ON notes (user_id, status, due_at)
  WHERE type = 'todo';

-- Reminder cron: find todos due soon
CREATE INDEX idx_notes_due_pending ON notes (due_at)
  WHERE type = 'todo' AND status = 'pending';

-- Semantic search: HNSW index for fast vector similarity
CREATE INDEX idx_notes_embedding ON notes
  USING hnsw (embedding vector_cosine_ops);

-- Dump feed: chronological
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC)
  WHERE type = 'dump';

-- Nudge scan: find nudge-eligible dumps
CREATE INDEX idx_notes_nudge ON notes (created_at)
  WHERE type = 'dump' AND nudge_status IS NULL;

-- Snoozed nudges: find snoozes that have expired
CREATE INDEX idx_notes_snooze ON notes (snooze_until)
  WHERE nudge_status = 'snoozed' AND snooze_until IS NOT NULL;
```

No JSONB. Todo-specific columns (`status`, `list`, `due_at`, `priority`) are null for dumps — enforced by app logic, not DB constraints (keeps it simple).

No `priority` default — app sets 'normal' for todos explicitly, leaves null for dumps.

Lists are strings, normalized to lowercase on save. The AI prompt instructs consistent naming, and the app lowercases + trims before storing. `SELECT DISTINCT list FROM notes WHERE type = 'todo' AND user_id = $1` gives all lists. Display with title case in the UI.

### users
```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id     bigint UNIQUE,
  email           text UNIQUE,
  timezone        text NOT NULL DEFAULT 'UTC',
  digest_enabled  boolean NOT NULL DEFAULT true,
  digest_time     time NOT NULL DEFAULT '08:00',
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**MVP: Single-user, no auth.** Telegram bot identifies you by `telegram_id`. Mobile/web app has no login — it's just you. This keeps MVP simple.

**Post-MVP:** Better Auth (email magic link, OAuth, session management). Linking Telegram: user sends /link command to bot, gets a code, enters it in the app.

## AI pipeline

### Classification + parsing (single LLM call)
Uses OpenAI structured outputs (response_format) for reliable JSON:

```json
{
  "type": "todo",
  "items": [
    { "summary": "Call mom", "due_expression": "next tuesday", "list": null, "priority": "normal" },
    { "summary": "Buy eggs", "due_expression": null, "list": "Groceries", "priority": "normal" }
  ]
}
```

For dumps:
```json
{
  "type": "dump",
  "items": [
    { "summary": "TikTok recruiter — follow up next week" }
  ]
}
```

### Type flip (re-parse)
If user flips dump → todo: new LLM call with `type` forced to "todo" to extract `due_expression`, `list`, `priority` from the raw input. Not a guess — a full re-parse.

### Date resolution
LLM extracts raw date expression ("next tuesday", "in 3 days"). Deterministic parser (chrono-node) resolves to actual timestamp using user's timezone. Two-step to avoid LLM hallucinating dates.

### Embedding generation
Async job after save (via Inngest). OpenAI text-embedding-3-small (1536 dims). Generated from `summary`, not `raw_input` — because multi-intent inputs get split into separate notes, and you want each note's embedding to reflect its own meaning, not the full original message. Updates the note row. Search uses pgvector `<=>` cosine distance with HNSW index.

### Stale commitment detection
Cron job (daily):
1. Find dumps where `nudge_status IS NULL` and `created_at < now() - interval '5 days'`
2. Batch LLM call: "Does this note contain an implicit commitment the user should act on?"
3. If yes: set `nudge_status = 'pending'`, send Telegram message
4. If no: set `nudge_status = 'dismissed'` (don't check again)

This uses LLM for detection, not keyword matching — catches "the landlord wants me to sign by Friday" that keywords would miss.

### Latency handling
LLM parsing takes 1-3 seconds.
- Telegram: bot sends "typing..." indicator while processing
- Mobile app: input bar shows spinner, optimistic "Saving..." state, preview card appears when parse completes
- If LLM fails: save raw_input with `summary = null`, queue a retry, show "Saved (processing...)"

## Tech stack

| Layer | Tech |
|-------|------|
| Mobile + Web | React Native + Expo (iOS, Android, web from one codebase) |
| Telegram | Telegram Bot API (webhooks) |
| Email | Resend (Phase 2) |
| Backend | Hono + tRPC |
| Auth | Better Auth (email magic link, OAuth, session management) |
| Database | Neon (PostgreSQL + pgvector) |
| ORM | Drizzle |
| AI | OpenAI (gpt-4o-mini for parsing, text-embedding-3-small for embeddings) |
| Desktop | Tauri (Phase 2 — capture overlay + notifications) |
| Voice | Whisper API (Phase 2) |
| Date parsing | chrono-node |
| Jobs | Inngest (cron for reminders/nudges, async for embeddings) |
| Monorepo | Turborepo + Bun |
| Infra | Vercel + Neon |

## Project structure
```
packages/
  core/            # shared types, zod schemas, date parser
  db/              # drizzle schema, migrations, queries
  ai/              # LLM parsing, embedding generation, commitment detection
  api/             # hono + tRPC routes, telegram webhook handler
apps/
  server/          # main API entry point
  client/          # react native + expo (iOS, Android, web)
  desktop/         # tauri overlay app (Phase 2)
```

Telegram bot logic lives in `packages/api/` as route handlers — not big enough for its own package.

## Search

Unified across todos and dumps:
```sql
SELECT id, summary, type, status, due_at, created_at,
       1 - (embedding <=> $query_embedding) AS similarity
FROM notes
WHERE user_id = $1
ORDER BY embedding <=> $query_embedding
LIMIT 10;
```

Filter by type optional. Results tagged with type indicators.

## Completion & lifecycle

- Todos: `pending → completed` or `pending → cancelled`
- Un-completable (revert to pending, clear completed_at)
- No delete — everything stays searchable forever
- Dumps: no lifecycle, just stored and searchable

## Phased roadmap

### Phase 1: MVP
The core loop end to end. Capture → parse → store → remind.

1. Hono + tRPC backend on Vercel
2. Better Auth setup (email magic link for app, telegram_id for bot)
3. Drizzle schema + Neon with pgvector enabled
4. AI classification + parsing endpoint (OpenAI structured outputs)
5. Telegram bot: webhook → auto-save → reply with parsed result + edit/undo
6. Embedding generation via Inngest async job
7. Semantic search via Telegram
8. Reminder cron: due today + overdue nudges via Telegram
9. Basic stale commitment detection
10. Mobile app (Expo): input bar, auto-save + preview card, home view, dump feed, search

### Phase 2: Desktop, voice, email + polish
- Desktop overlay app (Tauri): global hotkey → floating input → capture → dismiss
- Desktop notifications for reminders and nudges
- iOS Shortcut: Action Button → record → POST /voice → Whisper → parse
- Telegram voice messages → Whisper → parse
- Email digest via Resend (morning + weekly)
- Morning digest in Telegram
- Telegram commands (/today, /overdue, /search)
- Swipe gestures in mobile app
- Account linking (Telegram ↔ app)

### Phase 3: Intelligence
- Entity extraction (people, places, projects) + linking between notes
- Knowledge graph queries ("what do I know about [person]?")
- Cross-reference: creating a todo surfaces relevant dumps as context
- Native iOS widgets + live activities

## Interview framing
"I built a personal AI agent that you talk to like a friend — through Telegram, a React Native app, or a desktop overlay triggered by a global hotkey. You just tell it things, and it figures out what's actionable versus informational using a hybrid NLU pipeline with deterministic date parsing. Everything is stored with pgvector embeddings for semantic retrieval. The part I'm most proud of is the proactive agent: a scheduled job that uses LLM calls to detect implicit commitments in your notes and nudges you before you forget. Five clients — Telegram bot, iOS app, Android app, web app, desktop overlay — all share a single tRPC API on Hono, demonstrating multi-client architecture over one typed backend."
