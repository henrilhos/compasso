import { offers, type Db } from "@repo/db";
import type { CulturalEventClassificationStore } from "@repo/scrapers";
import { and, eq, inArray, isNull } from "drizzle-orm";

export interface CulturalEventStoreFilter {
  /** Narrows candidates to these offer ids. */
  ids?: string[];
  /** Narrows candidates to this source. */
  source?: string;
  /** Includes offers already classified, to reclassify them. */
  force?: boolean;
}

/**
 * `filter`, when given, narrows candidates further (e.g. a single offer or
 * source for a manual run); an offer already classified is skipped unless
 * `force` is set, same as the unfiltered backlog run.
 */
export function createCulturalEventStore(
  db: Db,
  filter: CulturalEventStoreFilter = {},
): CulturalEventClassificationStore {
  return {
    async listCandidates() {
      if (filter.ids && filter.ids.length === 0) return [];
      const conditions = filter.force
        ? []
        : [isNull(offers.culturalEventClassifiedAt)];
      if (filter.ids) conditions.push(inArray(offers.id, filter.ids));
      if (filter.source) conditions.push(eq(offers.source, filter.source));

      return db
        .select({
          id: offers.id,
          title: offers.title,
          description: offers.description,
        })
        .from(offers)
        .where(and(...conditions));
    },
    async applyClassification(id, { isCulturalEvent, confidence }) {
      await db
        .update(offers)
        .set({
          isCulturalEvent,
          culturalEventConfidence: confidence,
          culturalEventClassifiedAt: new Date(),
        })
        .where(eq(offers.id, id));
    },
  };
}
