import type { Municipality } from "@repo/db";
import {
  delay,
  httpFetch,
  paginate,
  parseDate,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const NITTIO_EVENTS_URL = "https://api.app.nittio.com.br/events";
const NITTIO_EVENT_URL = "https://app.nittio.com.br/event";
const NITTIO_PAGE_SIZE = 50;
const NITTIO_MAX_PAGES = 100;
// `app.nittio.com.br/robots.txt` pede `Crawl-delay: 1`.
const NITTIO_REQUEST_DELAY_MS = 1000;
const WINDOW_DAYS = 90;

interface NittioEventsResponse {
  data: unknown[];
  nextPage: string | null;
}

export function parseNittioEventsResponse(value: unknown): {
  items: unknown[];
  hasNextPage: boolean;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("Nittio response has an unexpected shape");
  }

  const result = value as Partial<NittioEventsResponse>;
  if (
    !Array.isArray(result.data) ||
    (result.nextPage !== null && typeof result.nextPage !== "string")
  ) {
    throw new Error("Nittio response has an unexpected shape");
  }

  return { items: result.data, hasNextPage: result.nextPage !== null };
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function mapNittioEvent(
  event: unknown,
  city: Municipality,
): Record<string, unknown> {
  const value = getRecord(event);
  const slug = getString(value.url);
  const startAt = getString(value.startAt);
  const flyers = Array.isArray(value.flyers) ? value.flyers : [];

  return {
    sourceOfferId: value._id,
    title: getString(value.title),
    url: slug ? `${NITTIO_EVENT_URL}/${encodeURIComponent(slug)}` : undefined,
    imageUrl: getString(flyers[0]),
    venueName: getString(value.place),
    city,
    startsAt: startAt ? parseDate(startAt) : undefined,
  };
}

/** Nittio lists no end time, so an offer is current while it hasn't started. */
function isWithinWindow(
  candidate: Record<string, unknown>,
  now: Date,
): boolean {
  const startsAt = candidate.startsAt;
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return true; // Let validation report the malformed date.
  }

  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return startsAt >= now && startsAt <= windowEnd;
}

/**
 * Public events feed of the Nittio app (`api.app.nittio.com.br`). The feed
 * carries no city, only the venue name, so the city comes from the `city`
 * query filter, which matches the exact accented name of a Municipality.
 * The catalog is not paged by date: the Janela is applied locally.
 */
export const nittioSource: OfferSource = {
  id: "nittio",
  name: "Nittio",
  async fetchOffers(city: Municipality) {
    await delay(NITTIO_REQUEST_DELAY_MS);

    const events = await paginate({
      maxPages: NITTIO_MAX_PAGES,
      delayMs: NITTIO_REQUEST_DELAY_MS,
      fetchPage: async (page) => {
        const url = new URL(NITTIO_EVENTS_URL);
        url.searchParams.set("city", city);
        url.searchParams.set("limit", String(NITTIO_PAGE_SIZE));
        url.searchParams.set("page", String(page));

        const response = await httpFetch(url.toString());
        if (!response.ok) {
          throw new Error(
            `Nittio returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }

        return parseNittioEventsResponse(await response.json());
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    const now = new Date();
    for (const event of events) {
      try {
        const candidate = mapNittioEvent(event, city);
        if (!isWithinWindow(candidate, now)) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(`[${nittioSource.id}] discarded malformed event:`, error);
      }
    }

    const validated = validateRawOffers(nittioSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
