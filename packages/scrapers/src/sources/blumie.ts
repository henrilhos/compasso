import type { CoveredCity } from "@repo/db";
import {
  httpFetch,
  paginate,
  parseDate,
  resolveCoveredCity,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const BLUMIE_SEARCH_URL = "https://api.blumie.com.br/api/v1/events/explore";
const BLUMIE_PAGE_SIZE = 40;
const BLUMIE_MAX_PAGES = 100;

interface BlumiePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BlumieSearchResponse {
  data: {
    events: unknown[];
    pagination: BlumiePagination;
  };
}

export function parseBlumieSearchResponse(value: unknown): {
  items: unknown[];
  hasNextPage: boolean;
} {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    throw new Error("Blumie response has an unexpected shape");
  }

  const data = (value as Partial<BlumieSearchResponse>).data;
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray(data.events) ||
    typeof data.pagination !== "object" ||
    data.pagination === null ||
    typeof data.pagination.page !== "number" ||
    typeof data.pagination.totalPages !== "number"
  ) {
    throw new Error("Blumie response has an unexpected shape");
  }

  return {
    items: data.events,
    hasNextPage: data.pagination.page < data.pagination.totalPages,
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapBlumieEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  const days = Array.isArray(value.days) ? value.days : [];
  const firstDay = getRecord(days[0]);
  const lastDay = getRecord(days[days.length - 1]);
  const city = getString(value.city);

  return {
    sourceOfferId: value.code,
    title: value.name,
    url:
      typeof value.code === "string"
        ? `https://blumie.com.br/event/${value.code}`
        : undefined,
    imageUrl: getString(value.bannerUrl),
    venueName: getString(value.locationName),
    city: city ? resolveCoveredCity(city) : undefined,
    startsAt:
      getString(firstDay.startDate) !== undefined
        ? parseDate(firstDay.startDate as string)
        : undefined,
    endsAt:
      getString(lastDay.endDate) !== undefined
        ? parseDate(lastDay.endDate as string)
        : undefined,
  };
}

/**
 * API pública em `api.blumie.com.br`. `days` é um array —
 * evento de vários dias vira uma Oferta só (ADR-0001).
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/8
 */
export const blumieSource: OfferSource = {
  id: "blumie",
  name: "Blumie",
  async fetchOffers(city: CoveredCity) {
    const events = await paginate({
      maxPages: BLUMIE_MAX_PAGES,
      fetchPage: async (page) => {
        const url = new URL(BLUMIE_SEARCH_URL);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(BLUMIE_PAGE_SIZE));
        url.searchParams.set("orderBy", "recent");
        url.searchParams.set("city", city);

        const response = await httpFetch(url.toString());
        if (!response.ok) {
          throw new Error(
            `Blumie returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }

        return parseBlumieSearchResponse(await response.json());
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    for (const event of events) {
      try {
        const candidate = mapBlumieEvent(event);
        if (candidate.city !== city) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(`[${blumieSource.id}] discarded malformed event:`, error);
      }
    }

    const validated = validateRawOffers(blumieSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
