# Grassdump

An AI-powered personal knowledge system and task manager. Dump unstructured thoughts via text/voice, AI parses and stores them, and you can search your memory semantically.

## Phase 1: Groundwork

### Infra
- [x] Monorepo setup (Turborepo + Bun)
- [x] Package structure (`core`, `db`, `ai`, `api`, `server`)
- [x] Neon database provisioned
- [ ] `.env` with database connection string
- [ ] Vercel project setup
- [ ] Terraform config (Vercel + Neon)

### Backend
- [ ] Hono server running locally
- [ ] Drizzle ORM connected to Neon
- [ ] Database schema + migrations
- [ ] tRPC router setup
- [ ] OpenAI client configured

### Frontend
- [ ] Expo app connects to local server
- [ ] tRPC client setup

### DevEx
- [x] Neon MCP for Claude Code
- [ ] Scripts for dev, build, migrate

## Structure

```
apps/
  client/          # React Native (Expo) — iOS, Android, web
  server/          # Hono API entry point
packages/
  core/            # Shared types, Zod schemas
  db/              # Drizzle schema, migrations
  ai/              # OpenAI integration
  api/             # Hono + tRPC routes
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React Native + Expo |
| Backend | Hono + tRPC |
| Database | PostgreSQL (Neon) + pgvector |
| ORM | Drizzle |
| AI | OpenAI |
| Auth | Better Auth |
| Infra | Vercel + Neon + Terraform |

## Getting Started

```bash
bun install
cd apps/server
bun run index.ts
```

See `spec/SPEC.md` for full project spec.
