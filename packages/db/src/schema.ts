import {
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
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    venueName: text("venue_name"),
    address: text("address"),
    city: text("city").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    priceMinCents: integer("price_min_cents"),
    priceMaxCents: integer("price_max_cents"),
    currency: text("currency").default("BRL"),
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
  ],
);

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;
