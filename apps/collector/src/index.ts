import { COVERED_CITIES, getDb, offers, type NewOffer } from "@repo/db";
import { enrichDescriptions, sources } from "@repo/scrapers";
import { sql } from "drizzle-orm";
import { createDescriptionStore } from "./description-store";
import { detailPageIntervalMs, detailPageLimit } from "./enrich-config";

function usefulText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
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
  const collectedOfferIds = new Set<string>();

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
          collectedOfferIds.add(newOffer.id);
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

  const descriptionStore = createDescriptionStore(db, collectedOfferIds);

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
