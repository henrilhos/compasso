import { offerDetailPages, offers, type Db } from "@repo/db";
import {
  DETAIL_PAGE_STATUSES,
  needsDescriptionEnrichment,
  type DescriptionEnrichmentStore,
  type DetailPageRecord,
} from "@repo/scrapers";
import { eq, inArray, sql } from "drizzle-orm";

/**
 * `offerIds`, when given, scopes candidates to that set (e.g. a single
 * collection run); omit it to consider every offer still needing enrichment.
 */
export function createDescriptionStore(
  db: Db,
  offerIds?: Iterable<string>,
): DescriptionEnrichmentStore {
  const scope = offerIds ? [...offerIds] : undefined;

  return {
    async listCandidates() {
      if (scope && scope.length === 0) return [];
      const rows = await db
        .select({
          id: offers.id,
          source: offers.source,
          url: offers.url,
          descriptionOrigin: offers.descriptionOrigin,
        })
        .from(offers)
        .where(scope ? inArray(offers.id, scope) : undefined);
      return rows
        .filter((offer) => needsDescriptionEnrichment(offer.descriptionOrigin))
        .map(({ id, source, url }) => ({ id, source, url }));
    },
    async getPage(url) {
      const [page] = await db
        .select({
          status: offerDetailPages.status,
          description: offerDetailPages.description,
          blockedAttempts: offerDetailPages.blockedAttempts,
        })
        .from(offerDetailPages)
        .where(eq(offerDetailPages.url, url));
      if (!page) return undefined;
      return DETAIL_PAGE_STATUSES.includes(
        page.status as DetailPageRecord["status"],
      )
        ? (page as DetailPageRecord)
        : undefined;
    },
    async savePage(page) {
      await db
        .insert(offerDetailPages)
        .values({
          ...page,
          blockedAttempts: page.blockedAttempts ?? 0,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: offerDetailPages.url,
          set: {
            ...page,
            blockedAttempts: page.blockedAttempts ?? 0,
            updatedAt: new Date(),
          },
        });
    },
    async applyDescription(id, description) {
      await db
        .update(offers)
        .set({
          description,
          descriptionOrigin: "detail",
          updatedAt: new Date(),
        })
        .where(
          sql`${offers.id} = ${id} and (${offers.descriptionOrigin} is null or ${offers.descriptionOrigin} = 'detail')`,
        );
    },
  };
}
