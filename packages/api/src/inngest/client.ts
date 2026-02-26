import { Inngest, EventSchemas } from "inngest";

// The events our app can send.
// TypeScript uses these to check you're sending the right data with each event.
type Events = {
  "note/created": {
    data: {
      noteId: string;
      summary: string;
      userId: string;
      dueAt: string | null; // ISO string or null
    };
  };
  "note/updated": {
    data: {
      noteId: string;
      summary: string;
      userId: string;
      dueAt: string | null;
    };
  };
};

// The central Inngest client. Everything imports this:
// - inngest.send() to fire events
// - inngest.createFunction() to define jobs that react to events
export const inngest = new Inngest({
  id: "grassdump",
  schemas: new EventSchemas().fromRecord<Events>(),
});
