import { afterEach, describe, expect, it, vi } from "vitest";
import { nittioSource, parseNittioEventsResponse } from "./nittio";

const event = {
  _id: "6a6a06148e591f0e55d2f31e",
  title: "Oktomed - 11ª edição",
  startAt: "2026-10-10T19:00:00.000Z",
  badges: [],
  place: "Rivage ",
  url: "oktomed-Rn9PDm",
  flyers: [
    "https://cdn.nittio.com.br/flyer.webp",
    "https://example.com/2.webp",
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function fetchOffers(
  city: Parameters<typeof nittioSource.fetchOffers>[0],
) {
  const promise = nittioSource.fetchOffers(city);
  await vi.runAllTimersAsync();
  return promise;
}

describe("parseNittioEventsResponse", () => {
  it("uses nextPage for pagination", () => {
    expect(parseNittioEventsResponse({ data: [event], nextPage: "2" })).toEqual(
      { items: [event], hasNextPage: true },
    );
    expect(
      parseNittioEventsResponse({ data: [event], nextPage: null }).hasNextPage,
    ).toBe(false);
  });

  it("rejects an unexpected response rather than treating it as empty", () => {
    expect(() => parseNittioEventsResponse({ data: [] })).toThrow(
      "Nittio response has an unexpected shape",
    );
  });
});

describe("nittioSource", () => {
  it("maps an event, takes the city from the requested filter, and paginates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [event], nextPage: "2" }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ ...event, _id: "second", title: "Segundo" }],
          nextPage: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOffers("Florianópolis");

    expect(result.skipped).toBe(0);
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toEqual({
      sourceOfferId: event._id,
      title: "Oktomed - 11ª edição",
      url: "https://app.nittio.com.br/event/oktomed-Rn9PDm",
      imageUrl: "https://cdn.nittio.com.br/flyer.webp",
      venueName: "Rivage",
      city: "Florianópolis",
      startsAt: new Date("2026-10-10T19:00:00.000Z"),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.app.nittio.com.br/events?city=Florian%C3%B3polis&limit=50&page=1",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.app.nittio.com.br/events?city=Florian%C3%B3polis&limit=50&page=2",
      expect.anything(),
    );
  });

  it("excludes past and beyond-window events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { ...event, _id: "past", startAt: "2026-09-30T22:00:00.000Z" },
            { ...event, _id: "future", startAt: "2027-01-10T22:00:00.000Z" },
            { ...event, _id: "within" },
          ],
          nextPage: null,
        }),
      ),
    );

    const result = await fetchOffers("Curitiba");

    expect(result.skipped).toBe(2);
    expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual([
      "within",
    ]);
  });

  it("discards events missing a slug or start date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { ...event, _id: "no-slug", url: undefined },
            { ...event, _id: "no-date", startAt: undefined },
          ],
          nextPage: null,
        }),
      ),
    );

    expect(await fetchOffers("Curitiba")).toEqual({ offers: [], skipped: 2 });
  });

  it("fails the city when the API errors, so the collector can report it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );

    const promise = nittioSource.fetchOffers("Curitiba");
    const assertion = expect(promise).rejects.toThrow(
      "Nittio returned HTTP 401 for Curitiba, page 1",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});
