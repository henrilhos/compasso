import { MUNICIPALITIES, type Municipality } from "@repo/db";
import { httpFetch, paginate, parseDate, validateRawOffers } from "../lib";
import type { OfferSource } from "../types";

const TICKETMASTER_EVENTS_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";
const TICKETMASTER_PAGE_SIZE = 200;
const TICKETMASTER_MAX_PAGES = 10;
const WINDOW_DAYS = 90;
const CITY_RADIUS_KM = 20;

interface TicketmasterEventsResponse {
  _embedded?: { events?: unknown[] };
  page: { number: number; totalPages: number };
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

// Ticketmaster's Brazilian venues almost never carry a city name, only
// coordinates. A venue belongs to the Municipality whose center is nearest,
// within `CITY_RADIUS_KM`, so a venue between two cities is returned once.
const CITY_CENTERS: Record<Municipality, Coordinates> = {
  Joinville: { latitude: -26.3045, longitude: -48.8487 },
  "Jaraguá do Sul": { latitude: -26.4851, longitude: -49.0662 },
  Itajaí: { latitude: -26.9078, longitude: -48.6619 },
  "Balneário Camboriú": { latitude: -26.9906, longitude: -48.6348 },
  Florianópolis: { latitude: -27.5954, longitude: -48.548 },
  "São José": { latitude: -27.6136, longitude: -48.6366 },
  Curitiba: { latitude: -25.4284, longitude: -49.2733 },
};

export function parseTicketmasterEventsResponse(value: unknown): {
  items: unknown[];
  hasNextPage: boolean;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("Ticketmaster response has an unexpected shape");
  }

  const result = value as Partial<TicketmasterEventsResponse>;
  const events = result._embedded?.events ?? [];
  if (
    !Array.isArray(events) ||
    typeof result.page?.number !== "number" ||
    typeof result.page.totalPages !== "number"
  ) {
    throw new Error("Ticketmaster response has an unexpected shape");
  }

  return {
    items: events,
    hasNextPage: result.page.number + 1 < result.page.totalPages,
  };
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

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function nearestMunicipality(venue: Coordinates): Municipality | undefined {
  let nearest: { city: Municipality; distance: number } | undefined;
  for (const city of MUNICIPALITIES) {
    const distance = distanceKm(venue, CITY_CENTERS[city]);
    if (
      distance <= CITY_RADIUS_KM &&
      (!nearest || distance < nearest.distance)
    ) {
      nearest = { city, distance };
    }
  }
  return nearest?.city;
}

function venueCoordinates(venue: Record<string, unknown>) {
  const location = getRecord(venue.location);
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : undefined;
}

/** The widest 16:9 image, which is the one the agenda card crops best. */
function pickImage(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const candidates = images
    .map(getRecord)
    .filter((image) => getString(image.url))
    .sort((a, b) => {
      const ratio = (image: Record<string, unknown>) =>
        image.ratio === "16_9" ? 1 : 0;
      return ratio(b) - ratio(a) || Number(b.width ?? 0) - Number(a.width ?? 0);
    });
  return getString(candidates[0]?.url);
}

function mapTicketmasterEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  const venue = getRecord(
    (getRecord(value._embedded).venues as unknown[] | undefined)?.[0],
  );
  const coordinates = venueCoordinates(venue);
  const start = getRecord(getRecord(value.dates).start);
  const startsAt = getString(start.dateTime);
  const address = [
    getString(getRecord(venue.address).line1),
    getString(venue.postalCode),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    sourceOfferId: value.id,
    title: getString(value.name),
    url: getString(value.url),
    imageUrl: pickImage(value.images),
    venueName: getString(venue.name),
    address: address || undefined,
    city: coordinates ? nearestMunicipality(coordinates) : undefined,
    startsAt: startsAt ? parseDate(startsAt) : undefined,
  };
}

function isListed(event: unknown): boolean {
  const value = getRecord(event);
  return (
    value.test !== true &&
    getRecord(getRecord(value.dates).status).code !== "cancelled"
  );
}

function isoWithoutMillis(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Official Discovery API, which needs `TICKETMASTER_API_KEY`. The query is a
 * radius around each Municipality's center and the Janela goes in the
 * request; the city of each event is then settled locally, see
 * `CITY_CENTERS`. The key travels in the URL, so URLs are never logged.
 */
export const ticketmasterSource: OfferSource = {
  id: "ticketmaster",
  name: "Ticketmaster",
  async fetchOffers(city: Municipality) {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      throw new Error("TICKETMASTER_API_KEY is not set");
    }

    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const center = CITY_CENTERS[city];

    const events = await paginate({
      maxPages: TICKETMASTER_MAX_PAGES,
      fetchPage: async (page) => {
        const url = new URL(TICKETMASTER_EVENTS_URL);
        url.searchParams.set("apikey", apiKey);
        url.searchParams.set("countryCode", "BR");
        url.searchParams.set(
          "latlong",
          `${center.latitude},${center.longitude}`,
        );
        url.searchParams.set("radius", String(CITY_RADIUS_KM));
        url.searchParams.set("unit", "km");
        url.searchParams.set("startDateTime", isoWithoutMillis(now));
        url.searchParams.set("endDateTime", isoWithoutMillis(windowEnd));
        url.searchParams.set("size", String(TICKETMASTER_PAGE_SIZE));
        url.searchParams.set("page", String(page - 1));

        const response = await httpFetch(url.toString());
        if (!response.ok) {
          throw new Error(
            `Ticketmaster returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }

        return parseTicketmasterEventsResponse(await response.json());
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    for (const event of events) {
      if (!isListed(event)) {
        skipped++;
        continue;
      }
      try {
        const candidate = mapTicketmasterEvent(event);
        if (candidate.city !== city) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(
          `[${ticketmasterSource.id}] discarded malformed event:`,
          error,
        );
      }
    }

    const validated = validateRawOffers(ticketmasterSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
