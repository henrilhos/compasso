import { delay } from "./delay";

export const DEFAULT_MAX_PAGES = 10;
export const DEFAULT_MAX_EMPTY_PAGES = 3;
export const DEFAULT_PAGE_DELAY_MS = 1000;

export interface FetchPageResult<T> {
  items: T[];
  /** Whether the source itself reports there's more to fetch. */
  hasNextPage: boolean;
}

export interface PaginateOptions<T> {
  fetchPage(pageNumber: number): Promise<FetchPageResult<T>>;
  /** Hard cap on pages, regardless of what the source reports. */
  maxPages?: number;
  /** Consecutive pages with zero usable items before giving up early. */
  maxEmptyPages?: number;
  /** Delay between page fetches — requests are sequential, never parallel. */
  delayMs?: number;
}

/**
 * Drives a paginated fetch, stopping at the first of three conditions
 * (see #3): the source reports it's done, `maxPages` is reached, or
 * `maxEmptyPages` consecutive pages come back with no usable items —
 * three, not one, because a single empty page usually means "that page
 * was all leaked-in offers from another city," not "the feed ended."
 */
export async function paginate<T>(
  options: PaginateOptions<T>,
): Promise<T[]> {
  const {
    fetchPage,
    maxPages = DEFAULT_MAX_PAGES,
    maxEmptyPages = DEFAULT_MAX_EMPTY_PAGES,
    delayMs = DEFAULT_PAGE_DELAY_MS,
  } = options;

  const results: T[] = [];
  let consecutiveEmptyPages = 0;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) {
      await delay(delayMs);
    }

    const { items, hasNextPage } = await fetchPage(page);
    results.push(...items);
    consecutiveEmptyPages =
      items.length === 0 ? consecutiveEmptyPages + 1 : 0;

    if (!hasNextPage || consecutiveEmptyPages >= maxEmptyPages) {
      break;
    }
  }

  return results;
}
