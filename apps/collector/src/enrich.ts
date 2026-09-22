import { getDb } from "@repo/db";
import { enrichDescriptions } from "@repo/scrapers";
import { createDescriptionStore } from "./description-store";
import { detailPageIntervalMs, detailPageLimit } from "./enrich-config";

/**
 * Standalone enrichment run: considers every offer still missing a
 * description, not just ones from a specific collection run. `collect`
 * scopes its own enrichment to what it just upserted, so this is what
 * works through the rest of the backlog.
 */
async function main() {
  const db = getDb();

  await enrichDescriptions({
    repository: createDescriptionStore(db),
    maxPages: detailPageLimit(),
    minIntervalMs: detailPageIntervalMs(),
  });
}

main();
