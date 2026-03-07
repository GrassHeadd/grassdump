import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.number().int().nullable(),
  email: z.string().email().nullable(),
  timezone: z.string().default("UTC"),
  digestEnabled: z.boolean().default(true),
  digestTime: z.string().default("08:00"), // stored as time string "HH:MM"
  createdAt: z.date(),
});

export type User = z.infer<typeof userSchema>;
