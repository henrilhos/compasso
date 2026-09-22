import { load } from "cheerio";

import { delay } from "./delay";
import { httpFetch } from "./http";

export const DETAIL_PAGE_STATUSES = [
  "described",
  "no_description",
  "temporary_failure",
  "not_found",
  "blocked",
] as const;

export type DetailPageStatus = (typeof DETAIL_PAGE_STATUSES)[number];

export interface DetailPageRecord {
  status: DetailPageStatus;
  description?: string;
  blockedAttempts?: number;
}

export interface DescriptionCandidate {
  id: string;
  source: string;
  url: string;
}

/** Persistence boundary used by the collector after listing upserts. */
export interface DescriptionEnrichmentStore {
  listCandidates(): Promise<DescriptionCandidate[]>;
  getPage(url: string): Promise<DetailPageRecord | undefined>;
  savePage(record: DetailPageRecord & { url: string }): Promise<void>;
  applyDescription(offerId: string, description: string): Promise<void>;
}

export interface EnrichDescriptionsOptions {
  repository: DescriptionEnrichmentStore;
  fetchPage?: (url: string) => Promise<Response>;
  maxPages?: number;
  minIntervalMs?: number;
}

const TRACKING_PARAMETER = /^(?:utm_.+|fbclid|gclid|dclid|_ga)$/i;

/** Gives one identity to URL variants that only differ by tracking tags. */
export function normalizeDetailUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

/** A listing description always takes precedence over detail-page text. */
export function needsDescriptionEnrichment(
  descriptionOrigin: string | null | undefined,
): boolean {
  return descriptionOrigin !== "listing";
}

function readableText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const $ = load(value);
  $("br").replaceWith("\n");
  $("p, li").each((_, element) => {
    $(element).append("\n\n");
  });
  const text = $.root()
    .text()
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text || undefined;
}

function eventDescription(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = eventDescription(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const isEvent = type === "Event" || (Array.isArray(type) && type.includes("Event"));
  if (isEvent && typeof record.description === "string") {
    return readableText(record.description);
  }
  for (const child of Object.values(record)) {
    const found = eventDescription(child);
    if (found) return found;
  }
  return undefined;
}

/** Extracts text scoped to an Event JSON-LD node or an explicit description area. */
export function extractDetailDescription(html: string): string | undefined {
  const $ = load(html);
  for (const script of $("script[type='application/ld+json']")) {
    try {
      const description = eventDescription(JSON.parse($(script).text()));
      if (description) return description;
    } catch {
      // Invalid structured data is common and does not make the page unusable.
    }
  }

  const section = $(
    "#description, [data-testid*='description' i], [class*='description' i], [id*='description' i]",
  ).first();
  if (section.length > 0) {
    const isLabel = /^(h[1-6]|label|legend)$/i.test(
      String(section.prop("tagName") ?? ""),
    );
    // Some pages (e.g. Sympla) match a heading like "Descrição do evento"
    // rather than the content itself; the real text sits in a sibling.
    const targets = isLabel
      ? [section.next(), section.parent().next()]
      : [section];
    for (const target of targets) {
      const description = readableText(target.html() ?? undefined);
      if (description) return description;
    }
  }

  // Last resort: many event pages (e.g. Next.js apps) never set og:type to
  // "event" or use Event microdata, so gating on those signals discards a
  // real description that is already scoped to this specific URL.
  return readableText($("meta[name='description']").attr("content") ?? undefined);
}

function isFinal(record: DetailPageRecord): boolean {
  return (
    record.status === "described" ||
    record.status === "no_description" ||
    record.status === "not_found" ||
    (record.status === "blocked" && (record.blockedAttempts ?? 0) >= 2)
  );
}

async function readPage(
  url: string,
  previous: DetailPageRecord | undefined,
  fetchPage: (url: string) => Promise<Response>,
): Promise<DetailPageRecord> {
  try {
    const response = await fetchPage(url);
    if (response.status === 404 || response.status === 410) {
      return { status: "not_found" };
    }
    if ([401, 403, 429].includes(response.status)) {
      return {
        status: "blocked",
        blockedAttempts: (previous?.blockedAttempts ?? 0) + 1,
      };
    }
    if (response.status >= 500 || !response.ok) {
      return {
        status: "temporary_failure",
        blockedAttempts: previous?.blockedAttempts ?? 0,
      };
    }
    const description = extractDetailDescription(await response.text());
    return description ? { status: "described", description } : { status: "no_description" };
  } catch {
    return {
      status: "temporary_failure",
      blockedAttempts: previous?.blockedAttempts ?? 0,
    };
  }
}

/**
 * Enriches candidates one normalized URL at a time. A failed URL is recorded
 * but never allowed to stop another URL from being processed.
 */
export async function enrichDescriptions({
  repository,
  fetchPage = (url) => httpFetch(url, { retries: 0 }),
  maxPages = 100,
  minIntervalMs = 1_000,
}: EnrichDescriptionsOptions): Promise<void> {
  const groups = new Map<string, DescriptionCandidate[]>();
  for (const candidate of await repository.listCandidates()) {
    const url = normalizeDetailUrl(candidate.url);
    groups.set(url, [...(groups.get(url) ?? []), candidate]);
  }

  const lastRequestAt = new Map<string, number>();
  let attempted = 0;
  for (const [url, candidates] of groups) {
    try {
      const previous = await repository.getPage(url);
      if (previous && isFinal(previous)) {
        // A previous successful read describes every Offer at this URL, even
        // one first observed in a later collection.
        if (previous.description) {
          await Promise.all(
            candidates.map((candidate) =>
              repository.applyDescription(candidate.id, previous.description!),
            ),
          );
        }
        continue;
      }
      if (attempted >= maxPages) break;

      const source = candidates[0]?.source;
      if (!source) continue;
      const elapsed = Date.now() - (lastRequestAt.get(source) ?? -Infinity);
      if (elapsed < minIntervalMs) await delay(minIntervalMs - elapsed);

      const result = await readPage(url, previous, fetchPage);
      lastRequestAt.set(source, Date.now());
      attempted++;
      await repository.savePage({ url, ...result });
      if (result.description) {
        await Promise.all(
          candidates.map((candidate) =>
            repository.applyDescription(candidate.id, result.description!),
          ),
        );
      }
    } catch (error) {
      // A broken page record or one Offer update must not stop later URLs.
      console.error(`Could not enrich detail page ${url}:`, error);
    }
  }
}
