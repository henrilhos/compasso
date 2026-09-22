import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const offers = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceOfferId: text("source_offer_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Whether the current description came from the listing or its detail URL. */
    descriptionOrigin: text("description_origin"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    venueName: text("venue_name"),
    address: text("address"),
    city: text("city").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isCulturalEvent: boolean("is_cultural_event"),
    /** Confidence (0-1) the classifier reported for `isCulturalEvent`. */
    culturalEventConfidence: doublePrecision("cultural_event_confidence"),
    /** Null means the offer still needs cultural-event classification. */
    culturalEventClassifiedAt: timestamp("cultural_event_classified_at", {
      withTimezone: true,
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("offers_source_source_offer_id_unique").on(
      table.source,
      table.sourceOfferId,
    ),
    index("offers_starts_at_idx").on(table.startsAt),
    index("offers_city_idx").on(table.city),
    index("offers_last_seen_at_idx").on(table.lastSeenAt),
  ],
);

export const offerDetailPages = pgTable(
  "offer_detail_pages",
  {
    url: text("url").primaryKey(),
    status: text("status").notNull(),
    description: text("description"),
    blockedAttempts: integer("blocked_attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("offer_detail_pages_status_idx").on(table.status)],
);

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;
