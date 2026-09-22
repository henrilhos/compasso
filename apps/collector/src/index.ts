import {
  COVERED_CITIES,
  getDb,
  offerDetailPages,
  offers,
  type NewOffer,
} from "@repo/db";
import {
  DETAIL_PAGE_STATUSES,
  enrichDescriptions,
  needsDescriptionEnrichment,
  sources,
  type DetailPageRecord,
  type DescriptionEnrichmentStore,
} from "@repo/scrapers";
import { eq, sql } from "drizzle-orm";

function usefulText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function detailPageLimit(): number {
  const value = Number(process.env.DETAIL_PAGE_MAX_PER_RUN ?? 100);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 100;
}

function detailPageIntervalMs(): number {
  const value = Number(process.env.DETAIL_PAGE_MIN_INTERVAL_MS ?? 1_000);
  return Number.isFinite(value) && value >= 0 ? value : 1_000;
}

function selectedSources(): typeof sources {
  const requested = process.argv.slice(2).filter((arg) => arg && arg !== "--");
  if (requested.length === 0) return sources;

  const unknown = requested.filter(
    (id) => !sources.some((source) => source.id === id),
  );
  if (unknown.length > 0) {
    const available = sources.map((source) => source.id).join(", ");
    throw new Error(
      `Unknown source(s): ${unknown.join(", ")}. Available: ${available}`,
    );
  }

  return sources.filter((source) => requested.includes(source.id));
}

async function main() {
  const db = getDb();
  const collectedAt = new Date();
  let upserted = 0;
  let skipped = 0;
  const failedSources = new Set<string>();

  for (const source of selectedSources()) {
    for (const city of COVERED_CITIES) {
      try {
        const { offers: rawOffers, skipped: sourceSkipped } =
          await source.fetchOffers(city);
        skipped += sourceSkipped;

        for (const rawOffer of rawOffers) {
          const description = usefulText(rawOffer.description);
          const newOffer: NewOffer = {
            id: `${source.id}:${rawOffer.sourceOfferId}`,
            source: source.id,
            sourceOfferId: rawOffer.sourceOfferId,
            title: rawOffer.title,
            description,
            descriptionOrigin: description ? "listing" : undefined,
            url: rawOffer.url,
            imageUrl: rawOffer.imageUrl,
            venueName: rawOffer.venueName,
            address: rawOffer.address,
            city: rawOffer.city,
            startsAt: rawOffer.startsAt,
            endsAt: rawOffer.endsAt,
            lastSeenAt: collectedAt,
            updatedAt: collectedAt,
          };

          await db
            .insert(offers)
            .values(newOffer)
            .onConflictDoUpdate({
              target: [offers.source, offers.sourceOfferId],
              set: {
                ...newOffer,
                // A listing's current text wins; an absent one never erases
                // useful text already obtained from a listing or detail page.
                description: sql`case when nullif(trim(excluded.description), '') is not null then excluded.description else ${offers.description} end`,
                descriptionOrigin: sql`case when nullif(trim(excluded.description), '') is not null then 'listing' else ${offers.descriptionOrigin} end`,
              },
            });
          upserted++;
        }
        console.log(
          `[${source.id}] ${city}: upserted ${rawOffers.length} offers, skipped ${sourceSkipped}`,
        );
      } catch (error) {
        failedSources.add(source.id);
        console.error(`[${source.id}] ${city}: failed:`, error);
      }
    }
  }

  const descriptionStore: DescriptionEnrichmentStore = {
    async listCandidates() {
      const rows = await db
        .select({
          id: offers.id,
          source: offers.source,
          url: offers.url,
          descriptionOrigin: offers.descriptionOrigin,
        })
        .from(offers);
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

  try {
    await enrichDescriptions({
      repository: descriptionStore,
      maxPages: detailPageLimit(),
      minIntervalMs: detailPageIntervalMs(),
    });
  } catch (error) {
    // The enrichment module isolates individual pages; this protects the
    // successful listing collection from an unexpected persistence failure.
    console.error("Description enrichment failed:", error);
  }

  console.log(
    `Done. ${upserted} offers upserted, ${skipped} skipped, ${failedSources.size} sources failed.`,
  );
  if (failedSources.size > 0) {
    process.exitCode = 1;
  }
}

main();
