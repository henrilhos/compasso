ALTER TABLE "offers" ADD COLUMN "description_origin" text;
--> statement-breakpoint
UPDATE "offers" SET "description_origin" = 'listing' WHERE "description" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "offer_detail_pages" (
	"url" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"description" text,
	"blocked_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "offer_detail_pages_status_idx" ON "offer_detail_pages" USING btree ("status");
