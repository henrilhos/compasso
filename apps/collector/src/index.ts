import { getDb, offers, type NewOffer } from "@repo/db";
import { sources } from "@repo/scrapers";

async function main() {
  const db = getDb();
  let upserted = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      const rawOffers = await source.fetchOffers();
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
          priceMinCents: rawOffer.priceMinCents,
          priceMaxCents: rawOffer.priceMaxCents,
          currency: rawOffer.currency,
          updatedAt: new Date(),
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
      console.log(`[${source.id}] upserted ${rawOffers.length} offers`);
    } catch (error) {
      failed++;
      console.error(`[${source.id}] failed:`, error);
    }
  }

  console.log(`Done. ${upserted} offers upserted, ${failed} sources failed.`);
  if (failed === sources.length) {
    process.exitCode = 1;
  }
}

main();
