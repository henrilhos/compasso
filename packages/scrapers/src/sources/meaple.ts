import type { CoveredCity } from "@repo/db";
import {
  delay,
  httpFetch,
  parseDate,
  resolveCoveredCity,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const MEAPLE_SEARCH_URL = "https://api.meaple.com.br/v1/events";
const MEAPLE_PAGE_SIZE = 50;
const MEAPLE_MAX_PAGES = 100;
const MEAPLE_PAGE_DELAY_MS = 1000;

interface MeapleSearchResponse {
  events: unknown[];
  cursor?: string;
}

export function parseMeapleSearchResponse(value: unknown): {
  items: unknown[];
  cursor: string | undefined;
} {
  if (typeof value !== "object" || value === null || !("events" in value)) {
    throw new Error("Meaple response has an unexpected shape");
  }

  const response = value as Partial<MeapleSearchResponse>;
  if (
    !Array.isArray(response.events) ||
    (response.cursor !== undefined && typeof response.cursor !== "string")
  ) {
    throw new Error("Meaple response has an unexpected shape");
  }

  return { items: response.events, cursor: response.cursor };
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function addressFromMeapleEvent(
  event: Record<string, unknown>,
): string | undefined {
  const address = getRecord(event.address);
  const parts = [
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
    address.zipCode,
  ].filter(
    (part): part is string | number =>
      typeof part === "string" || typeof part === "number",
  );

  return parts.length > 0 ? parts.map(String).join(", ") : undefined;
}

function mapMeapleEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  const address = getRecord(value.address);
  const city = getString(address.city);
  const timezone = getString(value.timezone) ?? "America/Sao_Paulo";
  const channel = getRecord(value.channel);
  const slug = getString(value.slug);
  const channelSlug = getString(channel.slug);

  return {
    sourceOfferId: value.id,
    title: value.name,
    url:
      channelSlug && slug
        ? `https://meaple.com.br/${channelSlug}/${slug}`
        : undefined,
    imageUrl: getString(getRecord(value.image).url),
    address: addressFromMeapleEvent(value),
    city: city ? resolveCoveredCity(city) : undefined,
    startsAt:
      getString(value.startsAt) !== undefined
        ? parseDate(value.startsAt as string, timezone)
        : undefined,
    endsAt:
      getString(value.endsAt) !== undefined
        ? parseDate(value.endsAt as string, timezone)
        : undefined,
  };
}

function shouldDiscardEvent(event: unknown): boolean {
  const value = getRecord(event);
  return value.canceledAt !== null || value.status !== "PUBLISHED";
}

/**
 * API pública em `api.meaple.com.br`. `city` é case-sensitive,
 * e esta fonte não tem nome de local em campo nenhum.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/9
 */
export const meapleSource: OfferSource = {
  id: "meaple",
  name: "Meaple",
  async fetchOffers(city: CoveredCity) {
    const events: unknown[] = [];
    let cursor: string | undefined;

    for (let page = 1; page <= MEAPLE_MAX_PAGES; page++) {
      if (page > 1) await delay(MEAPLE_PAGE_DELAY_MS);

      const url = new URL(MEAPLE_SEARCH_URL);
      url.searchParams.set("city", city);
      // Sem isso, `city` devolve resultado incompleto (ou vazio) sem erro
      // — não documentado, achado depurando #9. Ver issue para detalhes.
      url.searchParams.set("priority", "0");
      url.searchParams.set("limit", String(MEAPLE_PAGE_SIZE));
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await httpFetch(url.toString());
      if (!response.ok) {
        throw new Error(
          `Meaple returned HTTP ${response.status} for ${city}, page ${page}`,
        );
      }

      const result = parseMeapleSearchResponse(await response.json());
      events.push(...result.items);
      if (!result.cursor) break;
      cursor = result.cursor;
    }

    const candidates: unknown[] = [];
    let skipped = 0;
    for (const event of events) {
      try {
        if (shouldDiscardEvent(event)) {
          skipped++;
          continue;
        }
        const candidate = mapMeapleEvent(event);
        if (candidate.city !== city) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(`[${meapleSource.id}] discarded malformed event:`, error);
      }
    }

    const validated = validateRawOffers(meapleSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
