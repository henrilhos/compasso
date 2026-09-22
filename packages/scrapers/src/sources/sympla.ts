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

const SYMPLA_BASE_URL = "https://www.sympla.com.br/eventos";
const SYMPLA_MAX_PAGES = 100;
const SYMPLA_PAGE_SIZE = 24;

const CITY_SLUGS: Record<CoveredCity, string> = {
  "Joinville": "joinville-sc",
  "Jaraguá do Sul": "jaragua-do-sul-sc",
  "Itajaí": "itajai-sc",
  "Balneário Camboriú": "balneario-camboriu-sc",
  "Florianópolis": "florianopolis-sc",
  "São José": "sao-jose-sc",
  Curitiba: "curitiba-pr",
};

interface SymplaSearchResult {
  data: unknown[];
  total: number;
  limit: number;
  page: number;
}

function extractJsonObject(input: string, start: number): unknown {
  if (input[start] !== "{") {
    throw new Error("Expected a JSON object");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index++) {
    const character = input[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "{") depth++;
    else if (character === "}" && --depth === 0) {
      return JSON.parse(input.slice(start, index + 1));
    }
  }

  throw new Error("Unterminated JSON object");
}

/** Extracts Sympla's search result from its Next.js Flight HTML payload. */
export function parseSymplaSearchResult(html: string): SymplaSearchResult {
  const chunks: string[] = [];
  const $ = load(html);

  $("script").each((_, element) => {
    const script = $(element).text();
    const match = /^self\.__next_f\.push\((.*)\)\s*;?$/s.exec(script);
    if (!match) return;
    const argument = match[1];
    if (argument === undefined) return;

    try {
      const payload: unknown = JSON.parse(argument);
      if (
        Array.isArray(payload) &&
        payload[0] === 1 &&
        typeof payload[1] === "string"
      ) {
        chunks.push(payload[1]);
      }
    } catch {
      // Other Flight chunks are allowed to contain non-JSON JavaScript.
    }
  });

  const flightPayload = chunks.join("");
  const marker = '"searchDataResult":';
  const markerIndex = flightPayload.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Sympla searchDataResult was not found in the HTML");
  }

  const result = extractJsonObject(
    flightPayload,
    markerIndex + marker.length,
  ) as Partial<SymplaSearchResult>;

  if (
    !Array.isArray(result.data) ||
    typeof result.total !== "number" ||
    typeof result.limit !== "number" ||
    typeof result.page !== "number"
  ) {
    throw new Error("Sympla searchDataResult has an unexpected shape");
  }

  return result as SymplaSearchResult;
}

function addressFromLocation(
  location: Record<string, unknown>,
): string | undefined {
  const parts = [
    location.address,
    location.address_num,
    location.neighborhood,
    location.zip_code,
  ]
    .filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number",
    )
    .map(String);

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function mapSymplaEvent(event: unknown): Record<string, unknown> {
  const value = event as Record<string, unknown>;
  const location = (value.location ?? {}) as Record<string, unknown>;
  const city =
    typeof location.city === "string"
      ? resolveCoveredCity(location.city)
      : undefined;

  return {
    sourceOfferId: typeof value.id === "number" ? String(value.id) : value.id,
    title: value.name,
    url: value.url,
    imageUrl:
      typeof value.images === "object" && value.images !== null
        ? (value.images as Record<string, unknown>).original
        : undefined,
    venueName: location.name,
    address: addressFromLocation(location),
    city,
    startsAt:
      typeof value.start_date === "string"
        ? parseDate(value.start_date)
        : undefined,
    endsAt:
      typeof value.end_date === "string"
        ? parseDate(value.end_date)
        : undefined,
  };
}

/**
 * Sem API JSON: parsear o payload RSC (`self.__next_f`) da
 * listagem. A fonte de maior volume — ver a issue antes de começar.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/6
 */
export const symplaSource: OfferSource = {
  id: "sympla",
  name: "Sympla",
  async fetchOffers(city: CoveredCity) {
    const events = await paginate({
      maxPages: SYMPLA_MAX_PAGES,
      // The feed is regional and can contain several pages without the
      // requested city. Its `total` field, rather than an empty page, is the
      // reliable end condition.
      maxEmptyPages: SYMPLA_MAX_PAGES,
      fetchPage: async (page) => {
        const url = `${SYMPLA_BASE_URL}/${CITY_SLUGS[city]}?page=${page}`;
        const response = await httpFetch(url);
        if (!response.ok) {
          throw new Error(`Sympla returned HTTP ${response.status} for ${url}`);
        }

        const result = parseSymplaSearchResult(await response.text());
        return {
          items: result.data,
          hasNextPage:
            page * (result.limit || SYMPLA_PAGE_SIZE) < result.total,
        };
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    for (const event of events) {
      let candidate: Record<string, unknown>;
      try {
        candidate = mapSymplaEvent(event);
      } catch (error) {
        skipped++;
        console.warn(`[${symplaSource.id}] discarded malformed event:`, error);
        continue;
      }
      if (candidate.city !== city) {
        skipped++;
        continue;
      }
      candidates.push(candidate);
    }

    const validated = validateRawOffers(symplaSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
