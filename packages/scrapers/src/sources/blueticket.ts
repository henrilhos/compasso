import type { Municipality } from "@repo/db";
import {
  httpFetch,
  parseDate,
  resolveMunicipality,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const BLUETICKET_EVENTS_URL = "https://api2-cdn.blueticket.com.br/events";
const BLUETICKET_EVENT_URL = "https://www.blueticket.com.br/evento";
const WINDOW_DAYS = 90;

// The feed is national and several Brazilian cities share a name with a
// Municipality (São José also exists in other states), so the state must match.
const STATE_BY_MUNICIPALITY: Record<Municipality, string> = {
  Joinville: "SC",
  "Jaraguá do Sul": "SC",
  Itajaí: "SC",
  "Balneário Camboriú": "SC",
  Florianópolis: "SC",
  "São José": "SC",
  Curitiba: "PR",
};

export function parseBlueticketEventsResponse(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Blueticket response has an unexpected shape");
  }
  return value;
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

function municipalityOf(event: Record<string, unknown>) {
  const cityName = getString(event.cityName);
  const municipality = cityName ? resolveMunicipality(cityName) : undefined;
  return municipality &&
    getString(event.cityState) === STATE_BY_MUNICIPALITY[municipality]
    ? municipality
    : undefined;
}

/** `cancellationDate` is "0" while the event stands, a timestamp once cancelled. */
function isCancelled(event: Record<string, unknown>): boolean {
  return (
    typeof event.cancellationDate === "string" && event.cancellationDate !== "0"
  );
}

function mapBlueticketEvent(
  event: Record<string, unknown>,
  city: Municipality,
): Record<string, unknown> {
  const date = getString(event.date);
  const id = typeof event.id === "number" ? String(event.id) : undefined;

  return {
    sourceOfferId: id,
    title: getString(event.name),
    // The feed's `url` is the cover image; the event page is built from the id.
    url: id ? `${BLUETICKET_EVENT_URL}/${id}` : undefined,
    imageUrl: getString(event.url),
    venueName: getString(event.venue),
    city,
    // `date` has no offset: it is Brasília wall-clock time, which `parseDate`
    // assumes for offset-less strings.
    startsAt: date ? parseDate(date) : undefined,
  };
}

/** The feed lists no end time, so an offer is current while it hasn't started. */
function isWithinWindow(candidate: Record<string, unknown>, now: Date) {
  const startsAt = candidate.startsAt;
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return true; // Let validation report the malformed date.
  }

  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return startsAt >= now && startsAt <= windowEnd;
}

/**
 * Public events feed of the Blueticket site (`api2-cdn.blueticket.com.br`).
 * One request returns every event in the country, so each call fetches the
 * whole feed and keeps the events of the requested Municipality. The feed has
 * no description and the event page renders client-side, so enrichment
 * (ADR-0004) finds no text there; that is expected, not a failure.
 */
export const blueticketSource: OfferSource = {
  id: "blueticket",
  name: "Blueticket",
  async fetchOffers(city: Municipality) {
    const response = await httpFetch(BLUETICKET_EVENTS_URL);
    if (!response.ok) {
      throw new Error(
        `Blueticket returned HTTP ${response.status} for ${city}`,
      );
    }
    const events = parseBlueticketEventsResponse(await response.json());

    const candidates: unknown[] = [];
    let skipped = 0;
    const now = new Date();
    for (const item of events) {
      const event = getRecord(item);
      if (municipalityOf(event) !== city || isCancelled(event)) {
        skipped++;
        continue;
      }
      try {
        const candidate = mapBlueticketEvent(event, city);
        if (!isWithinWindow(candidate, now)) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(
          `[${blueticketSource.id}] discarded malformed event:`,
          error,
        );
      }
    }

    const validated = validateRawOffers(blueticketSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
