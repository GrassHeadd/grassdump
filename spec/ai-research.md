# AI Agent Architecture — Research Notes & Critique

Source: JJ's research doc synthesizing Anthropic, OpenAI, Google Research, Cognition, LangChain, MemGPT, and practitioner guides.

## Verdict: Architecture is right, scope is wrong for v1

The research recommends the correct architecture. Single agent, tool loop, pgvector memory, confidence-based routing — all the right choices for GrassDump's bounded domain. But it reads like a launch blueprint when it should be a north star. Build toward it incrementally.

---

## What to keep (core ideas that are correct)

### Single agent with tool loop

- GrassDump has ~12 tools, sequential tasks, latency matters. Multi-agent is overkill.
- The tool loop is simple: user message -> LLM -> text or tool call -> execute -> loop until done.
- This fits comfortably in modern context windows.

### Confidence spectrum (the most important design decision)

Four modes for the agent's behavior:

1. **Act immediately** — intent clear, all info present ("buy eggs" -> done)
2. **Act with stated assumption** — intent clear, minor detail missing ("remind me tomorrow" -> set 9am, offer correction)
3. **Ask one focused question** — critical info genuinely missing
4. **Suggest** — implicit commitment detected in a dump, surface it gently

This is what separates a good assistant from an annoying one. Worth the most iteration time.

### Tool descriptions > system prompt for tool selection

Anthropic says this is "by far the most important factor." The system prompt handles behavioral guidance (ordering, boundaries). Tool descriptions handle operational details (parameters, formats, caveats). Don't duplicate between them.

### Static vs dynamic prompt separation

Static instructions (personality, rules, tool usage guidance) stay cacheable. Dynamic context (current time, user memories, recent tasks) gets injected per-turn via a pre-step hook. This halves API costs by enabling prompt caching.

### Anti-patterns to avoid

- **The Clippy trap**: No unsolicited messages, no pre-scripted greetings, no interrupting flow
- **Chat replacing UI**: Chat for input, structured UI for display. Don't show 20 tasks in a chat bubble.
- **Asking permission for everything**: Low-risk + clear intent = just do it
- **Storing everything in memory**: Only preferences, patterns, facts. Not transient queries or chitchat.
- **Kitchen-sink prompts**: Small prompts that do one thing well > one mega-prompt

---

## What to change or defer

### Vercel AI SDK 6 — decide deliberately

The research recommends AI SDK 6's ToolLoopAgent. But:

- It's not in the current stack (Hono + tRPC + OpenAI directly)
- The tool loop is ~50 lines of code to implement yourself
- Adding it brings a lot of abstraction for something simple
- **Decision needed**: Is the DX worth the dependency? Or just build the loop manually?

### 12 tools at launch — too many, start with 5

Launch tools:

1. `create_todo` — actionable tasks, reminders
2. `create_dump` — thoughts, ideas, notes
3. `search_entries` — pgvector semantic search
4. `list_todos` — filtered/sorted task list
5. `update_entry` — modify existing entries

Add later based on real usage:

- `delete_entry` (needs confirmation UX first)
- `set_due_date` / `reschedule` (can be handled by update_entry initially)
- `get_schedule_context` (needs calendar integration)
- `generate_summary` (Phase 3+ feature)
- `save_memory` / `search_memory` (after basic loop works)

### Three-layer memory — only build layers 1 and 2 for now

- **Layer 1 (core context)**: User profile, top memories, today's schedule, recent turns. Always in prompt. < 800 tokens. Build this.
- **Layer 2 (semantic memory)**: pgvector-backed store for all todos, dumps, saved memories. Searched via tools. Build this.
- **Layer 3 (background patterns)**: Async analysis of conversations to detect recurring patterns ("user adds groceries every Sunday"). **Defer this.** Not enough data to detect patterns until weeks of real usage.

### RRULE for recurring tasks — premature

No UI to display recurring task instances yet. Store simple recurrence as an enum (`weekly`, `daily`, `weekdays`, `monthly`) for now. Upgrade to full RRULE when the display layer catches up.

### chrono-node date validation — solve a real problem first

GPT models with the current date in the prompt handle "next Tuesday" fine 95%+ of the time. Test with real inputs first. Add chrono-node as a fallback only when you see actual date parsing failures. Don't build validation for hypothetical bugs.

### Strict mode disables parallel tool calls on OpenAI

`strict: true` gives 100% schema compliance but forces sequential tool calls. For GrassDump this is probably fine (latency matters less than correctness), but worth knowing the trade-off.

---

## Gaps in the research

### No mention of Inngest integration

The scheduled reminders, cron jobs, and background processing already built are part of the agent's nervous system. How do agent tool calls trigger Inngest functions? How do Inngest-driven events (reminder fired, daily review time) initiate agent responses?

### No mention of existing tRPC routes

The tools should call existing tRPC procedures, not bypass them. The `notes.ts` routes already handle CRUD — tools are a thin layer on top.

### Telegram as the interface

The research assumes a chat UI with streaming, rich components, etc. GrassDump uses Telegram. Interaction patterns are different:

- No streaming (Telegram sends complete messages)
- No rich UI components alongside chat
- Message length limits
- Inline keyboards for quick actions (confirm delete, pick option)
- The bot already works — agent layer wraps around existing webhook handler

### Cost estimation missing

Every agent loop turn = 1 API call. A 3-turn tool loop on a single message = 3x cost. Need a per-message budget estimate. With gpt-4o-mini this is cheap, but worth tracking from day one.

### No evaluation plan

The research mentions "don't ignore evaluation" but doesn't propose one. Need:

- Tool selection accuracy (did it pick the right tool?)
- Parameter validity (dates correct? IDs exist?)
- Confidence calibration (asks when it should, acts when it should)
- Memory precision (stores the right things, skips the rest)
- Start with a spreadsheet of 20 real messages and expected behaviors. Run them manually.

---

## Build order suggestion

1. Implement the tool loop (with or without AI SDK 6 — decide first)
2. Wire up 5 core tools to existing tRPC routes
3. Write the system prompt (static part only, keep it short)
4. Add prepareStep for dynamic context injection (time, recent tasks)
5. Test with real Telegram messages, tune confidence behavior
6. Add pgvector memory search as a tool
7. Add remaining tools as needed
8. Layer 3 memory and background patterns (way later)
