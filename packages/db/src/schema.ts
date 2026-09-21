import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceEventId: text("source_event_id").notNull(),
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
    unique("events_source_source_event_id_unique").on(
      table.source,
      table.sourceEventId,
    ),
    index("events_starts_at_idx").on(table.startsAt),
    index("events_city_idx").on(table.city),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
