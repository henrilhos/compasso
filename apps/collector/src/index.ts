import { events, getDb, type NewEvent } from "@repo/db";
import { sources } from "@repo/scrapers";

async function main() {
  const db = getDb();
  let upserted = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      const rawEvents = await source.fetchEvents();
      for (const rawEvent of rawEvents) {
        const newEvent: NewEvent = {
          id: `${source.id}:${rawEvent.sourceEventId}`,
          source: source.id,
          sourceEventId: rawEvent.sourceEventId,
          title: rawEvent.title,
          description: rawEvent.description,
          url: rawEvent.url,
          imageUrl: rawEvent.imageUrl,
          venueName: rawEvent.venueName,
          address: rawEvent.address,
          city: rawEvent.city,
          startsAt: rawEvent.startsAt,
          endsAt: rawEvent.endsAt,
          priceMinCents: rawEvent.priceMinCents,
          priceMaxCents: rawEvent.priceMaxCents,
          currency: rawEvent.currency,
          updatedAt: new Date(),
        };

        await db
          .insert(events)
          .values(newEvent)
          .onConflictDoUpdate({
            target: [events.source, events.sourceEventId],
            set: newEvent,
          });
        upserted++;
      }
      console.log(`[${source.id}] upserted ${rawEvents.length} events`);
    } catch (error) {
      failed++;
      console.error(`[${source.id}] failed:`, error);
    }
  }

  console.log(`Done. ${upserted} events upserted, ${failed} sources failed.`);
  if (failed === sources.length) {
    process.exitCode = 1;
  }
}

main();
