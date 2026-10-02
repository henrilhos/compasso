import type { Municipality } from "@repo/db";
import {
  delay,
  httpFetch,
  paginate,
  parseDate,
  readableText,
  resolveMunicipality,
  validateRawOffers,
} from "../lib";
import type { OfferSource } from "../types";

const DISK_BASE_URL = "https://www.diskingressos.com.br";
const DISK_SEARCH_URL = `${DISK_BASE_URL}/home/_search`;
const DISK_PAGE_SIZE = 500;
const DISK_MAX_PAGES = 10;
// The site has no `robots.txt` and states no crawl delay, so we pick one.
const DISK_REQUEST_DELAY_MS = 1000;
const WINDOW_DAYS = 90;
const BLOCKED_REASON =
  "not working around it, see docs/adr/0006-disk-ingressos-sem-contornar-bloqueio.md";

// The body the site's own home page sends: what is still on sale, soonest first.
const DISK_SEARCH_BODY = JSON.stringify({
  query: { bool: { must: [{ range: { finalsale: { gte: "now" } } }] } },
  sort: [{ data: { order: "asc" } }],
});

interface DiskSearchResponse {
  hits: { total: number; hits: { _source?: unknown }[] };
}

/** `from` is the offset this page was requested at. */
export function parseDiskIngressosSearchResponse(
  value: unknown,
  from: number,
): { items: unknown[]; hasNextPage: boolean } {
  const hits = (value as Partial<DiskSearchResponse> | null)?.hits;
  if (typeof hits?.total !== "number" || !Array.isArray(hits.hits)) {
    throw new Error("Disk Ingressos response has an unexpected shape");
  }

  return {
    items: hits.hits.map((hit) => hit?._source),
    hasNextPage: from + hits.hits.length < hits.total,
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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapDiskEvent(event: unknown): Record<string, unknown> {
  const value = getRecord(event);
  // A group is one event on sale on several dates, listed once with `id: 0`
  // and `uid: "<groupid>-G"`. Event and group ids are separate sequences (3416
  // is both an event and a group), so only `uid` is unique across the feed.
  const isGroup = getString(value.uid)?.endsWith("-G") === true;
  const id = isGroup ? value.groupid : value.id;
  const date = getString(value.openh);
  const state = getString(value.state);
  const city = getString(value.city);
  const startsAt = getString(value.data);
  const endsAt = getString(value.finalsale);
  const image = getString(value.imagewebp) ?? getString(value.image);

  return {
    sourceOfferId: getString(value.uid),
    title: getString(value.eventname),
    // Only events have prose; a group's `description` is a list of search tags.
    description: isGroup
      ? undefined
      : readableText(getString(value.description)),
    url:
      id && date && state && city
        ? `${DISK_BASE_URL}/${isGroup ? "grupo" : "evento"}/${id}/${date}/${slugify(state)}/${slugify(city)}/${id}`
        : undefined,
    imageUrl: image ? new URL(image, DISK_BASE_URL).toString() : undefined,
    venueName: getString(value.local),
    city: city ? resolveMunicipality(city) : undefined,
    startsAt: startsAt ? parseDate(startsAt) : undefined,
    // A group's date is its first day, so it ends when its sales close. An
    // event's sales close right after it starts, which says nothing about its end.
    endsAt: isGroup && endsAt ? parseDate(endsAt) : undefined,
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
 * Disk Ingressos' own search, an Elasticsearch passthrough the site's
 * AngularJS front end calls from the browser. It lists every city at once, so
 * the city is settled locally from each item's `city`. If the site starts
 * blocking the collector (HTTP 403/429, or the Queue-Fair queue answering
 * instead of the API) the Source fails and does not work around it, see
 * ADR-0006.
 */
export const diskIngressosSource: OfferSource = {
  id: "diskingressos",
  name: "Disk Ingressos",
  async fetchOffers(city: Municipality) {
    await delay(DISK_REQUEST_DELAY_MS);

    const events = await paginate({
      maxPages: DISK_MAX_PAGES,
      delayMs: DISK_REQUEST_DELAY_MS,
      fetchPage: async (page) => {
        const from = (page - 1) * DISK_PAGE_SIZE;
        const url = new URL(DISK_SEARCH_URL);
        url.searchParams.set("size", String(DISK_PAGE_SIZE));
        url.searchParams.set("from", String(from));

        const response = await httpFetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: DISK_SEARCH_BODY,
        });
        if (response.status === 403 || response.status === 429) {
          throw new Error(
            `Disk Ingressos blocked the collector (HTTP ${response.status}); ${BLOCKED_REASON}`,
          );
        }
        if (!response.ok) {
          throw new Error(
            `Disk Ingressos returned HTTP ${response.status} for ${city}, page ${page}`,
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error(
            `Disk Ingressos did not answer with JSON (queue?); ${BLOCKED_REASON}`,
          );
        }
        return parseDiskIngressosSearchResponse(body, from);
      },
    });

    const candidates: unknown[] = [];
    let skipped = 0;
    const now = new Date();
    for (const event of events) {
      try {
        const candidate = mapDiskEvent(event);
        if (candidate.city !== city || !isWithinWindow(candidate, now)) {
          skipped++;
          continue;
        }
        candidates.push(candidate);
      } catch (error) {
        skipped++;
        console.warn(
          `[${diskIngressosSource.id}] discarded malformed event:`,
          error,
        );
      }
    }

    const validated = validateRawOffers(diskIngressosSource.id, candidates);
    return {
      offers: validated.offers,
      skipped: skipped + validated.skipped,
    };
  },
};
