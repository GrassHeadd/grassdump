import {
  getTodosDueSoon as dbGetDueSoon,
  getTodosJustDue as dbGetJustDue,
  markReminderSent as dbMarkSent,
} from "@repo/db";

export async function getTodosDueSoon(withinHours: number = 24) {
  return dbGetDueSoon(withinHours);
}

export async function getTodosJustDue() {
  return dbGetJustDue();
}

export async function markReminderSent(noteId: string) {
  return dbMarkSent(noteId);
}
