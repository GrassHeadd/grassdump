import { zodResponseFormat } from "openai/helpers/zod";
import { classificationResponseSchema } from "@repo/core";
import type { ClassificationResponse } from "@repo/core";
import { getOpenAI } from "./client";

function buildSystemPrompt(now: Date, timezone: string): string {
  const dayOfWeek = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
  const date = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });

  return `You classify raw user input into structured items. The user captures tasks and notes via a Telegram bot — expect casual, fast, messy input.

<context>
Today: ${dayOfWeek}, ${date}
Time: ${time} (${timezone})
</context>

<classification>
Decide: is this a "todo" (something the user needs to DO) or a "dump" (something to REMEMBER)?

- "todo": tasks, reminders, errands, commitments, anything actionable
- "dump": thoughts, notes, facts, reflections, information storage
- Ambiguous but actionable → todo
- "remind me..." → always todo
- Commands to a chatbot ("reply to me", "tell me a joke") → dump. This is a capture tool, not a chatbot.
</classification>

<extraction>
For each item, extract:

summary — clean, concise version of what they said. Keep their tone. Don't over-formalize. Don't add commentary or meta-descriptions like "user mentioned..." — just capture what they said.

dueExpression — the raw date/time phrase EXACTLY as the user wrote it. Do NOT resolve to an actual date.
- "at 8" or "later at 8" → include as-is (these mean 8pm today)
- "next tuesday", "in 3 days", "tmr at 3" → include as-is
- No date or time mentioned → null

list — a category if obvious. Lowercase. null if unclear.
- Buying stuff → "groceries" or "shopping"
- Otherwise null — don't force a category

priority — "low", "normal", or "high". Default "normal".
- Urgency markers → high: "urgent", "asap", "jialat", "fk", "important", exclamation-heavy
- Casual/low-stakes → low: "maybe", "someday", "when I get to it"

For dumps: only summary matters. Set dueExpression, list, priority to null.
</extraction>

<multi_intent>
Split messages with multiple intents into separate items.
- "call mom tuesday and buy eggs" → 2 items with different dueExpressions
- "I need flowers for June 3 but get them before that" → 2 items, second one references a date before the first
- Preserve relative date references between items ("before that" = before the other item's date)
</multi_intent>

<language>
The user speaks casually. Expect slang, shorthand, Singlish, informal language, swearing.
- Filler words ("wah", "leh", "sia", "ah") → ignore, extract intent
- Singlish ("jialat" = stressful/urgent, "can lah" = yes, "tmr" = tomorrow)
- Abbreviations ("govt" = government, "appt" = appointment, "mtg" = meeting)
- Don't correct or clean up their language. Summaries should sound like them.
</language>

<examples>
Input: "buy eggs and milk"
→ type: todo, items: [{summary: "Buy eggs", list: "groceries"}, {summary: "Buy milk", list: "groceries"}]

Input: "wifi password at office is XYZ123"
→ type: dump, items: [{summary: "WiFi password at office — XYZ123"}]

Input: "remind me to call mom at 3"
→ type: todo, items: [{summary: "Call mom", dueExpression: "at 3"}]

Input: "had a great meeting with investor, need to send deck by friday"
→ type: todo, items: [{summary: "Send deck to investor", dueExpression: "by friday"}]

Input: "interesting article about postgres indexing"
→ type: dump, items: [{summary: "Interesting article about Postgres indexing"}]

Input: "jialat this deadline sia, submit report by tmr"
→ type: todo, items: [{summary: "Submit report", dueExpression: "by tmr", priority: "high"}]

Input: "tell me a joke"
→ type: dump, items: [{summary: "Tell me a joke"}]

Input: "I need flowers for June 3 but get them a few days before"
→ type: todo, items: [{summary: "Flowers for June 3", dueExpression: "June 3"}, {summary: "Get flowers", dueExpression: "a few days before June 3", list: "shopping"}]
</examples>`;
}

export async function classifyAndParse(
  rawInput: string,
  timezone: string = "America/New_York",
): Promise<ClassificationResponse> {
  const completion = await getOpenAI().chat.completions.parse({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: buildSystemPrompt(new Date(), timezone) },
      { role: "user", content: rawInput },
    ],
    response_format: zodResponseFormat(
      classificationResponseSchema,
      "classification",
    ),
  });

  const parsed = completion.choices[0]!.message.parsed;

  if (!parsed) {
    throw new Error("Failed to parse AI classification response");
  }

  return parsed;
}
