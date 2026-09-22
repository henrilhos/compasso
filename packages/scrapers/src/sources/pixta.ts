import { load } from "cheerio";
import type { CoveredCity } from "@repo/db";
import {
  httpFetch,
  paginate,
  parseDate,
  resolveCoveredCity,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const PIXTA_SEARCH_URL = "https://pixta.me/search";
const PIXTA_PAGE_SIZE = 100;
const PIXTA_MAX_PAGES = 100;
const WINDOW_DAYS = 90;

interface PixtaSearchResponse {
  events: unknown[];
  total: number;
  page: number | string;
  per_page: number | string;
}

export function parsePixtaSearchResponse(value: unknown): {
  items: unknown[];
  hasNextPage: boolean;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("Pixta response has an unexpected shape");
  }

  const result = value as Partial<PixtaSearchResponse>;
  const page = Number(result.page);
  const perPage = Number(result.per_page);
  if (
    !Array.isArray(result.events) ||
    typeof result.total !== "number" ||
    !Number.isInteger(result.total) ||
    result.total < 0 ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(perPage) ||
    perPage < 1
  ) {
    throw new Error("Pixta response has an unexpected shape");
  }

  return {
    items: result.events,
    hasNextPage: page * perPage < result.total,
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function descriptionFromBio(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const description = load(value).text().replace(/\s+/g, " ").trim();
  return description || undefined;
}

function mapPixtaEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  const slug = getString(value.slug);
  const cityName = getString(getRecord(value.city).name);
  const secretLocation = value.secret_location === true;

  return {
    sourceOfferId: value.id,
    title: value.name,
    url: slug
      ? `https://pixta.me/events/${encodeURIComponent(slug)}`
      : undefined,
    imageUrl:
      getString(value.cover_picture_webp_url) ??
      getString(value.cover_picture_url),
    ...(!secretLocation && {
      description: descriptionFromBio(value.bio),
      venueName: getString(getRecord(value.venue).name),
    }),
    city: cityName ? resolveCoveredCity(cityName) : undefined,
    startsAt: getString(value.event_starts_at)
      ? parseDate(value.event_starts_at as string)
      : undefined,
    endsAt: getString(value.event_ends_at)
      ? parseDate(value.event_ends_at as string)
      : undefined,
  };
}

function isWithinWindow(
  candidate: Record<string, unknown>,
  now: Date,
): boolean {
  const startsAt = candidate.startsAt;
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return true; // Let validation report the malformed date.
  }

  const end = candidate.endsAt instanceof Date ? candidate.endsAt : startsAt;
  if (Number.isNaN(end.getTime())) return true;
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return end >= now && startsAt <= windowEnd;
}

/**
 * Pixta's public search includes all cities. Filter locally so spelling
 * variants such as "Curitiba " still resolve to the same Covered City.
 */
export const pixtaSource: OfferSource = {
  id: "pixta",
  name: "Pixta",
  async fetchOffers(city: CoveredCity) {
    const events = await paginate({
      maxPages: PIXTA_MAX_PAGES,
      fetchPage: async (page) => {
        const url = new URL(PIXTA_SEARCH_URL);
        url.searchParams.set("page", String(page));
        url.searchParams.set("per_page", String(PIXTA_PAGE_SIZE));

        const response = await httpFetch(url.toString());
        if (!response.ok) {
          throw new Error(
            `Pixta returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }

        return parsePixtaSearchResponse(await response.json());
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    const now = new Date();
    for (const event of events) {
      try {
        const candidate = mapPixtaEvent(event);
        if (candidate.city !== city || !isWithinWindow(candidate, now)) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(`[${pixtaSource.id}] discarded malformed event:`, error);
      }
    }

    const validated = validateRawOffers(pixtaSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
