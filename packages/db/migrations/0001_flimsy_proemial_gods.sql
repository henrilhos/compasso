ALTER TABLE "offers" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "offers_last_seen_at_idx" ON "offers" USING btree ("last_seen_at");