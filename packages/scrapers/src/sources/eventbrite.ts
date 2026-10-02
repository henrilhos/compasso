import { randomBytes } from "node:crypto";
import { MUNICIPALITIES, type Municipality } from "@repo/db";
import {
  httpFetch,
  paginate,
  parseLocalDateTime,
  resolveMunicipality,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

/**
 * API JSON real com cookie CSRF anônimo gerado por requisição. Atenção:
 * `address.city` guarda o bairro, não a cidade. A cidade é extraída do
 * endereço localizado antes da validação do contrato comum dos scrapers.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/7
 */
const EVENTBRITE_SEARCH_URL =
  "https://www.eventbrite.com.br/api/v3/destination/search/";
const EVENTBRITE_PAGE_SIZE = 50;
const EVENTBRITE_MAX_PAGES = 100;

const CITY_CONFIG: Record<
  Municipality,
  { pageUrl: string; placeId: string }
> = {
  "Joinville": {
    pageUrl: "https://www.eventbrite.com.br/d/brazil--joinville/events/",
    placeId: "101964301",
  },
  "Jaraguá do Sul": {
    pageUrl:
      "https://www.eventbrite.com.br/d/brazil--jaragua-do-sul/events/",
    placeId: "101964113",
  },
  "Itajaí": {
    pageUrl: "https://www.eventbrite.com.br/d/brazil--itajai/events/",
    placeId: "101958121",
  },
  "Balneário Camboriú": {
    pageUrl:
      "https://www.eventbrite.com.br/d/brazil--balneario-camboriu/events/",
    placeId: "85682021",
  },
  "Florianópolis": {
    pageUrl:
      "https://www.eventbrite.com.br/d/brazil--florianopolis/events/",
    placeId: "101958175",
  },
  "São José": {
    pageUrl: "https://www.eventbrite.com.br/d/brazil--sao-jose/events/",
    placeId: "101960931",
  },
  Curitiba: {
    pageUrl: "https://www.eventbrite.com.br/d/brazil--curitiba/events/",
    placeId: "101957995",
  },
};

interface EventbritePagination {
  page_number: number;
  page_count: number;
}

interface EventbriteSearchResponse {
  events: {
    results: unknown[];
    pagination: EventbritePagination;
  };
}

export function parseEventbriteSearchResponse(value: unknown): {
  items: unknown[];
  hasNextPage: boolean;
} {
  if (typeof value !== "object" || value === null || !("events" in value)) {
    throw new Error("Eventbrite response has an unexpected shape");
  }

  const events = (value as Partial<EventbriteSearchResponse>).events;
  if (
    typeof events !== "object" ||
    events === null ||
    !Array.isArray(events.results) ||
    typeof events.pagination !== "object" ||
    events.pagination === null ||
    typeof events.pagination.page_number !== "number" ||
    typeof events.pagination.page_count !== "number"
  ) {
    throw new Error("Eventbrite response has an unexpected shape");
  }

  return {
    items: events.results,
    hasNextPage:
      events.pagination.page_number < events.pagination.page_count,
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function cityFromAddress(address: string): Municipality | undefined {
  for (const part of address.split(",")) {
    const city = resolveMunicipality(part.trim());
    if (city) return city;
  }

  // Some responses don't put the city between commas (for example, when the
  // address is abbreviated). Keep the match bounded so "São José" does not
  // accidentally match a different municipality's longer name.
  const normalizedAddress = address
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase();
  return MUNICIPALITIES.find((city) => {
    const normalizedCity = city
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLocaleLowerCase();
    return new RegExp(`(^|[^a-z])${normalizedCity}([^a-z]|$)`).test(
      normalizedAddress,
    );
  });
}

function mapEventbriteEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  const venue = getRecord(value.primary_venue);
  const address = getRecord(venue.address);
  const addressText = getString(address.localized_address_display);
  const timezone = getString(value.timezone) ?? "America/Sao_Paulo";

  return {
    sourceOfferId:
      typeof value.id === "number" ? String(value.id) : value.id,
    title: value.name,
    description: getString(value.summary),
    url: value.url,
    imageUrl: getString(getRecord(value.image).url),
    venueName: getString(venue.name),
    address: addressText,
    city: addressText ? cityFromAddress(addressText) : undefined,
    startsAt:
      getString(value.start_date) && getString(value.start_time)
        ? parseLocalDateTime(
            value.start_date as string,
            value.start_time as string,
            timezone,
          )
        : undefined,
    endsAt:
      getString(value.end_date) && getString(value.end_time)
        ? parseLocalDateTime(
            value.end_date as string,
            value.end_time as string,
            timezone,
          )
        : undefined,
  };
}

function shouldDiscardEvent(event: unknown): boolean {
  const value = getRecord(event);
  return (
    value.is_cancelled === true ||
    value.is_online_event === true ||
    value.event_sales_status === "event_cancelled"
  );
}

export const eventbriteSource: OfferSource = {
  id: "eventbrite",
  name: "Eventbrite",
  async fetchOffers(city: Municipality) {
    const config = CITY_CONFIG[city];
    // The destination API accepts a matching anonymous CSRF cookie and header.
    // Fetching the listing page first fails with HTTP 405 on Actions runners.
    const csrfToken = randomBytes(16).toString("hex");

    const events = await paginate({
      maxPages: EVENTBRITE_MAX_PAGES,
      fetchPage: async (page) => {
        const response = await httpFetch(EVENTBRITE_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `csrftoken=${csrfToken}`,
            "X-CSRFToken": csrfToken,
            Referer: config.pageUrl,
          },
          body: JSON.stringify({
            event_search: {
              dates: "current_future",
              dedup: true,
              places: [config.placeId],
              page,
              page_size: EVENTBRITE_PAGE_SIZE,
              online_events_only: false,
            },
            "expand.destination_event": [
              "primary_venue",
              "image",
              "ticket_availability",
              "primary_organizer",
            ],
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Eventbrite returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }
        return parseEventbriteSearchResponse(await response.json());
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    for (const event of events) {
      try {
        if (shouldDiscardEvent(event)) {
          skipped++;
          continue;
        }
        const candidate = mapEventbriteEvent(event);
        if (candidate.city !== city) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(
          `[${eventbriteSource.id}] discarded malformed event:`,
          error,
        );
      }
    }

    const validated = validateRawOffers(eventbriteSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
