# GrassDump

AI-powered personal capture system. Dump thoughts via Telegram, AI classifies them as todos or dumps, and you can search your memory semantically.

## What works

- Telegram bot: send any text, AI classifies and saves it
- Agent loop: creates todos with due dates, dumps for loose thoughts, searches past notes
- Semantic search: vector embeddings via pgvector
- Commitment detection: daily scan flags stale todos with nudges
- Scheduled reminders: minute-by-minute due checks + daily digest at 8 AM user-local time
- tRPC API: today view, dump feed, search, create, complete, edit, flip type

## Structure

```
apps/
  server/            # Bun entry point — just boots Hono
  client/            # React Native (Expo) — not started yet

packages/
  core/              # Shared Zod types + date parser
  db/                # Drizzle models + DAO layer (Neon/pgvector)
  ai/                # OpenAI agent, embeddings, commitment detection
  service/           # Business logic — single gate between API and DB/AI
  api/               # Hono + tRPC routes, Telegram webhook, cron jobs
```

### Dependency flow

```
core → db → ai → service → api → server
```

API only imports from `service`. Service orchestrates `db` and `ai`. Nothing reaches across layers.

## Tech stack

| Layer    | Tech                                          |
| -------- | --------------------------------------------- |
| Runtime  | Bun                                           |
| Monorepo | Turborepo                                     |
| API      | Hono + tRPC                                   |
| Database | PostgreSQL (Neon) + pgvector                  |
| ORM      | Drizzle                                       |
| AI       | OpenAI (gpt-4o-mini + text-embedding-3-small) |
| Auth     | Better Auth (not wired yet)                   |
| Frontend | React Native + Expo (not started)             |

## Getting started

```bash
bun install
# Run from repo root (Bun only loads .env from CWD)
bun run apps/server/index.ts
```

Needs a `.env` at repo root with:

- `DATABASE_URL` — Neon connection string
- `OPENAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `DEV_USER_TELEGRAM_ID` — your Telegram user ID (dev auth)

## Docs

- Spec: `spec/SPEC.md`
- Implementation plan: `spec/IMPLEMENTATION.md`
