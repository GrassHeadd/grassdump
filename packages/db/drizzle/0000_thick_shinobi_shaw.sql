CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_input" text NOT NULL,
	"summary" text,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"status" text,
	"list" text,
	"due_at" timestamp with time zone,
	"priority" text,
	"completed_at" timestamp with time zone,
	"nudge_status" text,
	"nudged_at" timestamp with time zone,
	"snooze_until" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"telegram_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint,
	"email" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"digest_time" time DEFAULT '08:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notes_user_status_due" ON "notes" USING btree ("user_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_notes_user_created" ON "notes" USING btree ("user_id","created_at");