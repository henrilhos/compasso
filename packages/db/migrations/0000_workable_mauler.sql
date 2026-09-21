CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_offer_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"image_url" text,
	"venue_name" text,
	"address" text,
	"city" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"price_min_cents" integer,
	"price_max_cents" integer,
	"currency" text DEFAULT 'BRL',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_source_source_offer_id_unique" UNIQUE("source","source_offer_id")
);
--> statement-breakpoint
CREATE INDEX "offers_starts_at_idx" ON "offers" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "offers_city_idx" ON "offers" USING btree ("city");