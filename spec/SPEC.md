# BrainDump (working title)

## One-liner
An AI-powered personal knowledge system and task manager. You dump unstructured thoughts via text/voice, AI parses and stores them as structured notes, and you can search your own memory semantically.

## Two core modules

### 1. Todo — Voice/text-first task capture
- Input: natural language via voice or text ("remind me to call mom next Tuesday at 3pm and add milk to my groceries list")
- AI parses into structured tasks with correct dates, times, lists, and actions
- Supports multi-intent parsing (one input → multiple tasks)
- Hybrid NLU pipeline: LLM for intent extraction, deterministic date parser to avoid hallucinated dates
- Confidence scoring for ambiguous inputs — asks for clarification instead of guessing

### 2. Dump — Searchable external memory / second brain
- Input: unstructured brain dumps, random thoughts, anything
- NOT meant to become tasks — it's a personal memory layer
- AI stores with embeddings for semantic search
- You can search later: "what was that thing about the recruiter?" and it retrieves relevant dumps

## Architecture

### Modular monolith (NOT microservices)
- One backend with clean package separation (todo, dump, shared)
- Can be split later if needed, but start monolith
- Two modules talk to each other — when creating a todo, app can surface relevant dumps as context

### Tech stack
- **Frontend:** React Native (TypeScript) with Expo — iOS, Android, and web from one codebase
- **Backend:** TypeScript — Hono + tRPC for typed API layer
- **Database:** PostgreSQL (Neon) + pgvector — structured storage + vector embeddings for semantic search
- **ORM:** Drizzle ORM
- **AI/LLM:** OpenAI API for NLU parsing + embeddings generation. Claude as alternative for reasoning.
- **Auth:** Clerk
- **Jobs:** Inngest or BullMQ (async embedding generation, reminders)
- **Monorepo:** Turborepo
- **Infra:** Docker, Railway or Fly.io

### High-level flow
```
User (voice/text) → React Native app → API
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
                   NLU Parser                        Embedding Gen
                   (LLM + date parser)               (OpenAI)
                        │                                   │
                        └─────────────────┬─────────────────┘
                                          ▼
                                    PostgreSQL + pgvector
                                    (notes, embeddings)
```

## Database schema

### notes — everything you dump or create as a task
- id (uuid, PK)
- user_id (uuid)
- raw_input (text) — original voice/text input
- summary (text) — AI-generated clean summary
- type (enum: todo, dump)
- data (jsonb) — flexible structured data depending on type
- due_at (timestamp) — when task is due (for todos)
- completed_at (timestamp) — when task was completed
- embedding (vector 1536) — for semantic search
- created_at (timestamp)

## AI responsibilities
1. Parse raw input → structured note (todo or dump)
2. Generate embeddings for semantic search
3. For todo: extract date expressions, pass to deterministic date parser for resolution
4. For dump: just store and embed

## Example flows

### Todo capture
```
Input: "call mom tuesday and buy eggs"
→ Creates 2 tasks:
  - Task 1: "Call mom" | due: next Tuesday
  - Task 2: "Buy eggs" | list: Groceries (auto-detected)
→ Shows parse preview, user confirms with one tap
```

### Brain dump
```
Input: "that tiktok recruiter said follow up next week"
→ Stores as note (type: dump)
→ Searchable later via "what did I say about tiktok"
```

### Semantic search
```
Query: "what was that thing about the lease?"
→ Vector similarity search across all notes
→ Returns: "Your landlord emailed about the lease renewal" (from a dump 2 weeks ago)
```

## UI (React Native)

### Input
- Bottom input bar always visible with text field + mic button
- Tap anywhere → keyboard for typing
- Tap mic → immediate voice recording
- After input: parse preview card shows what AI understood
- One tap to confirm, or edit before saving
- Toggle between "Todo" and "Dump" mode

### Todo views
- Default: "Today + Upcoming" — what's next without cognitive load
- Side nav or tabs: Day / Week / Month views
- Quick reschedule gestures (swipe to move to tomorrow etc.)

### Dump views
- Search bar with semantic search
- Chronological feed of past dumps

## Project structure (TypeScript monorepo)
```
packages/
  core/            # shared types, schemas, utils, zod validators
  db/              # drizzle schema, migrations, queries
  ai/              # LLM parsing, embedding generation
  api/             # hono + tRPC routes, middleware
apps/
  server/          # main API entry point
  app/             # React Native (Expo) — iOS, Android, web
```

## MVP scope (build this first)
1. Text input API endpoint (skip voice for MVP — just text)
2. AI parsing for both todo and dump
3. Store notes + embeddings in PostgreSQL + pgvector
4. Basic retrieval: by time range, semantic search
5. Simple React Native UI: input bar, today view, dump feed, search

## Later phases
- Voice input (native speech-to-text on device)
- Home screen widget for quick capture
- Notifications and reminders
- On-device Whisper for offline transcription
- Desktop app (Tauri) with global hotkey
- Cross-device sync
- Proactive nudges ("you said you'd follow up with the recruiter — it's been a week")
- Integrations (calendar, email, etc.)
- Entity extraction and knowledge graph (people, places, projects)

## Interview framing
"I built a voice-first personal operating system with an AI-powered NLU pipeline for structured extraction from unstructured input, semantic search using pgvector, and a full-stack TypeScript monorepo with typed end-to-end APIs."
