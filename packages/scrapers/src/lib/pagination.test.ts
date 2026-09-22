import { describe, expect, it, vi } from "vitest";
import { paginate } from "./pagination";

describe("paginate", () => {
  it("stops when the source reports there's no next page", async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: [page],
      hasNextPage: page < 3,
    }));

    const items = await paginate({ fetchPage, delayMs: 0 });

    expect(items).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("stops after the max page count even if the source claims more", async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: [page],
      hasNextPage: true,
    }));

    const items = await paginate({ fetchPage, delayMs: 0, maxPages: 10 });

    expect(items).toHaveLength(10);
    expect(fetchPage).toHaveBeenCalledTimes(10);
  });

  it("stops after N consecutive pages with no usable items", async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: page <= 2 ? [page] : [],
      hasNextPage: true,
    }));

    const items = await paginate({
      fetchPage,
      delayMs: 0,
      maxEmptyPages: 3,
    });

    // pages 1-2 usable, then 3 consecutive empty pages (3, 4, 5) trip the stop.
    expect(items).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it("resets the empty-page streak when a usable page appears", async () => {
    const pages: number[][] = [[1], [], [], [2], [], [], []];
    const fetchPage = vi.fn(async (page: number) => ({
      items: pages[page - 1] ?? [],
      hasNextPage: true,
    }));

    const items = await paginate({
      fetchPage,
      delayMs: 0,
      maxEmptyPages: 3,
      maxPages: 10,
    });

    expect(items).toEqual([1, 2]);
    // page 4 (usable) resets the streak, so it takes pages 5,6,7 to stop again.
    expect(fetchPage).toHaveBeenCalledTimes(7);
  });

  it("waits delayMs between page fetches, not before the first or after the last", async () => {
    vi.useFakeTimers();
    const fetchPage = vi.fn(async (page: number) => ({
      items: [page],
      hasNextPage: page < 3,
    }));

    const promise = paginate({ fetchPage, delayMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchPage).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchPage).toHaveBeenCalledTimes(3);

    const items = await promise;
    expect(items).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });
});
