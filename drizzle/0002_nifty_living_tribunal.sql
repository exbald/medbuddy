CREATE TABLE "adherence_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"medication_id" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"taken_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'web',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "caretaker_link" (
	"id" text PRIMARY KEY NOT NULL,
	"caretaker_id" text,
	"patient_id" text,
	"invite_code" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "caretaker_link_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'web',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"med_a_id" text NOT NULL,
	"med_b_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medication" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"dosage" text,
	"purpose" text,
	"timing" text[],
	"active" boolean DEFAULT true,
	"scan_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"time_slot" text NOT NULL,
	"scheduled_time" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" text DEFAULT 'zh-TW';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'patient';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "adherence_log" ADD CONSTRAINT "adherence_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adherence_log" ADD CONSTRAINT "adherence_log_medication_id_medication_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caretaker_link" ADD CONSTRAINT "caretaker_link_caretaker_id_user_id_fk" FOREIGN KEY ("caretaker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caretaker_link" ADD CONSTRAINT "caretaker_link_patient_id_user_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_med_a_id_medication_id_fk" FOREIGN KEY ("med_a_id") REFERENCES "public"."medication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_med_b_id_medication_id_fk" FOREIGN KEY ("med_b_id") REFERENCES "public"."medication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adherence_log_user_id_idx" ON "adherence_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "adherence_log_medication_id_idx" ON "adherence_log" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "adherence_log_scheduled_at_idx" ON "adherence_log" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "caretaker_link_caretaker_id_idx" ON "caretaker_link" USING btree ("caretaker_id");--> statement-breakpoint
CREATE INDEX "caretaker_link_patient_id_idx" ON "caretaker_link" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "caretaker_link_invite_code_idx" ON "caretaker_link" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "chat_message_user_id_idx" ON "chat_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_created_at_idx" ON "chat_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interaction_user_id_idx" ON "interaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_user_id_idx" ON "medication" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_active_idx" ON "medication" USING btree ("active");--> statement-breakpoint
CREATE INDEX "reminder_user_id_idx" ON "reminder" USING btree ("user_id");