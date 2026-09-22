ALTER TABLE "offers" ADD COLUMN "is_cultural_event" boolean;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "cultural_event_confidence" double precision;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "cultural_event_classified_at" timestamp with time zone;
