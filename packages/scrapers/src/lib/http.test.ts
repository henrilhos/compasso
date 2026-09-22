import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpFetch, USER_AGENT } from "./http";

function jsonResponse(status = 200) {
  return new Response("{}", { status });
}

describe("httpFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the Compasso User-Agent header", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(),
    );
    vi.stubGlobal("fetch", fetchMock);

    await httpFetch("https://example.com");

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    const [, init] = call;
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent")).toBe(USER_AGENT);
  });

  it("returns the response on first success, without retrying", async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await httpFetch("https://example.com");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff after a network error, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(jsonResponse());
    vi.stubGlobal("fetch", fetchMock);

    const promise = httpFetch("https://example.com", { retries: 2 });
    await vi.advanceTimersByTimeAsync(10_000);

    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a 5xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = httpFetch("https://example.com", { retries: 2 });
    await vi.advanceTimersByTimeAsync(10_000);

    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a 4xx response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const response = await httpFetch("https://example.com", { retries: 2 });

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network error"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = httpFetch("https://example.com", { retries: 2 });
    // Attach a catch handler synchronously so the eventual rejection
    // doesn't surface as an unhandled rejection while timers advance.
    const assertion = expect(promise).rejects.toThrow("network error");
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborts the request once timeoutMs elapses", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = httpFetch("https://example.com", {
      timeoutMs: 5000,
      retries: 0,
    });
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
