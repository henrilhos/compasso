import { COVERED_CITIES, getDb, offers, type NewOffer } from "@repo/db";
import { sources } from "@repo/scrapers";

async function main() {
  const db = getDb();
  const collectedAt = new Date();
  let upserted = 0;
  let skipped = 0;
  const failedSources = new Set<string>();

  for (const source of sources) {
    for (const city of COVERED_CITIES) {
      try {
        const { offers: rawOffers, skipped: sourceSkipped } =
          await source.fetchOffers(city);
        skipped += sourceSkipped;

        for (const rawOffer of rawOffers) {
          const newOffer: NewOffer = {
            id: `${source.id}:${rawOffer.sourceOfferId}`,
            source: source.id,
            sourceOfferId: rawOffer.sourceOfferId,
            title: rawOffer.title,
            description: rawOffer.description,
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
              set: newOffer,
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

  console.log(
    `Done. ${upserted} offers upserted, ${skipped} skipped, ${failedSources.size} sources failed.`,
  );
  if (failedSources.size > 0) {
    process.exitCode = 1;
  }
}

main();
