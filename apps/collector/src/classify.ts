import { getDb } from "@repo/db";
import { classifyCulturalEvents, sources } from "@repo/scrapers";
import {
  createCulturalEventStore,
  type CulturalEventStoreFilter,
} from "./cultural-event-store";
import {
  culturalEventClassificationLimit,
  typesafeAiApiKey,
} from "./classify-config";

function flagValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function parseFilter(): CulturalEventStoreFilter {
  const source = flagValue("source");
  if (source && !sources.some((known) => known.id === source)) {
    const available = sources.map((known) => known.id).join(", ");
    throw new Error(`Unknown source "${source}". Available: ${available}`);
  }

  const id = flagValue("id");
  const force = process.argv.slice(2).includes("--force");
  return { ids: id ? [id] : undefined, source, force };
}

/**
 * Standalone classification run: works through every offer still missing
 * an `is_cultural_event` judgment, independent of collection. Pass
 * `--id=<offerId>` or `--source=<sourceId>` to narrow a manual run, and
 * `--force` to reclassify offers that already have a judgment.
 */
async function main() {
  const db = getDb();

  await classifyCulturalEvents({
    repository: createCulturalEventStore(db, parseFilter()),
    apiKey: typesafeAiApiKey(),
    maxItems: culturalEventClassificationLimit(),
  });
}

main();
