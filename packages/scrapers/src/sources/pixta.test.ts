import { afterEach, describe, expect, it, vi } from "vitest";
import { pixtaSource, parsePixtaSearchResponse } from "./pixta";

const event = {
  id: "cdc6eb59-2fe8-4bab-980c-430cc2de0591",
  name: "Dub Inna Town #02",
  slug: "dub-inna-town-02",
  bio: "<p>Dub <strong>em Joinville</strong></p>",
  cover_picture_webp_url: "https://example.com/dub.webp",
  event_starts_at: "2026-10-09T20:00:00.000-03:00",
  event_ends_at: "2026-10-10T04:00:00.000-03:00",
  secret_location: false,
  venue: { name: "Pousada Bella Vista" },
  city: { name: "Joinville" },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parsePixtaSearchResponse", () => {
  it("uses the search envelope for pagination", () => {
    expect(
      parsePixtaSearchResponse({
        events: [event],
        total: 101,
        page: "1",
        per_page: "100",
      }),
    ).toEqual({ items: [event], hasNextPage: true });

    expect(
      parsePixtaSearchResponse({
        events: [],
        total: 101,
        page: 2,
        per_page: 100,
      }).hasNextPage,
    ).toBe(false);
  });

  it("rejects an unexpected response rather than treating it as empty", () => {
    expect(() => parsePixtaSearchResponse({ events: [] })).toThrow(
      "Pixta response has an unexpected shape",
    );
  });
});

describe("pixtaSource", () => {
  it("maps a public offer and excludes cities outside the requested city", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        events: [event, { ...event, id: "other", city: { name: "Curitiba " } }],
        total: 2,
        page: 1,
        per_page: 100,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await pixtaSource.fetchOffers("Joinville")).toEqual({
      skipped: 1,
      offers: [
        {
          sourceOfferId: event.id,
          title: event.name,
          url: "https://pixta.me/events/dub-inna-town-02",
          imageUrl: "https://example.com/dub.webp",
          description: "Dub em Joinville",
          venueName: "Pousada Bella Vista",
          city: "Joinville",
          startsAt: new Date("2026-10-09T23:00:00.000Z"),
          endsAt: new Date("2026-10-10T07:00:00.000Z"),
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pixta.me/search?page=1&per_page=100",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("includes Curitiba variants and hides secret venue and description", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          events: [
            {
              ...event,
              city: { name: "Curitiba " },
              secret_location: true,
              bio: "<p>Rua secreta 123</p>",
              venue: { name: "Local secreto" },
            },
            { ...event, id: "no-city", city: null },
          ],
          total: 2,
          page: 1,
          per_page: 100,
        }),
      ),
    );

    const result = await pixtaSource.fetchOffers("Curitiba");
    expect(result.skipped).toBe(1);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toEqual(
      expect.objectContaining({ city: "Curitiba" }),
    );
    expect(result.offers[0]).not.toHaveProperty("venueName");
    expect(result.offers[0]).not.toHaveProperty("description");
  });

  it("excludes past and beyond-window offers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          events: [
            {
              ...event,
              id: "past",
              event_starts_at: "2026-09-01T20:00:00-03:00",
              event_ends_at: "2026-09-01T23:00:00-03:00",
            },
            {
              ...event,
              id: "future",
              event_starts_at: "2027-01-01T20:00:00-03:00",
              event_ends_at: "2027-01-01T23:00:00-03:00",
            },
          ],
          total: 2,
          page: 1,
          per_page: 100,
        }),
      ),
    );

    expect(await pixtaSource.fetchOffers("Joinville")).toEqual({
      offers: [],
      skipped: 2,
    });
  });
});
