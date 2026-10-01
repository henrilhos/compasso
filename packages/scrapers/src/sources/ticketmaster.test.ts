import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseTicketmasterEventsResponse,
  ticketmasterSource,
} from "./ticketmaster";

function venueAt(latitude: string, longitude: string, name = "Venue") {
  return {
    name,
    address: {},
    city: {},
    postalCode: "80020-250",
    location: { latitude, longitude },
  };
}

const event = {
  id: "ZFIMVHtnMZ17Fb7k",
  name: "Maiara & Maraisa - Cine Lido",
  test: false,
  url: "https://www.ticketmaster.com.br/event/maiara-e-maraisa-cine-lido",
  images: [
    { ratio: "3_2", url: "https://img.test/3_2_big.jpg", width: 2048 },
    { ratio: "16_9", url: "https://img.test/16_9_small.jpg", width: 640 },
    { ratio: "16_9", url: "https://img.test/16_9_big.jpg", width: 1024 },
  ],
  dates: {
    start: { dateTime: "2026-10-24T01:00:00Z" },
    status: { code: "onsale" },
  },
  _embedded: {
    venues: [venueAt("-25.4297578", "-49.2690632", "Cine Lido")],
  },
};

function response(events: unknown[], page = { number: 0, totalPages: 1 }) {
  return Response.json({ _embedded: { events }, page });
}

beforeEach(() => {
  vi.stubEnv("TICKETMASTER_API_KEY", "secret-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseTicketmasterEventsResponse", () => {
  it("paginates by the zero-based page number", () => {
    expect(
      parseTicketmasterEventsResponse({
        _embedded: { events: [event] },
        page: { number: 0, totalPages: 2 },
      }),
    ).toEqual({ items: [event], hasNextPage: true });
    expect(
      parseTicketmasterEventsResponse({
        _embedded: { events: [event] },
        page: { number: 1, totalPages: 2 },
      }).hasNextPage,
    ).toBe(false);
  });

  it("treats a response without _embedded as no events", () => {
    expect(
      parseTicketmasterEventsResponse({ page: { number: 0, totalPages: 0 } }),
    ).toEqual({ items: [], hasNextPage: false });
  });

  it("rejects an unexpected response rather than treating it as empty", () => {
    expect(() => parseTicketmasterEventsResponse({})).toThrow(
      "Ticketmaster response has an unexpected shape",
    );
  });
});

describe("ticketmasterSource", () => {
  it("maps an event and queries a radius around the city within the Janela", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(response([event]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ticketmasterSource.fetchOffers("Curitiba");

    expect(result).toEqual({
      skipped: 0,
      offers: [
        {
          sourceOfferId: event.id,
          title: "Maiara & Maraisa - Cine Lido",
          url: event.url,
          imageUrl: "https://img.test/16_9_big.jpg",
          venueName: "Cine Lido",
          address: "80020-250",
          city: "Curitiba",
          startsAt: new Date("2026-10-24T01:00:00.000Z"),
        },
      ],
    });
    const requested = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      apikey: "secret-key",
      countryCode: "BR",
      latlong: "-25.4284,-49.2733",
      radius: "20",
      unit: "km",
      startDateTime: "2026-10-01T12:00:00Z",
      endDateTime: "2026-12-30T12:00:00Z",
      size: "200",
      page: "0",
    });
  });

  it("gives a venue between two Covered Cities only to the nearest one", async () => {
    vi.useFakeTimers();
    // Between the Florianópolis and São José centers, closer to São José.
    const between = {
      ...event,
      _embedded: { venues: [venueAt("-27.6097", "-48.6566", "Arena Opus")] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(response([between]))),
    );

    expect(await ticketmasterSource.fetchOffers("Florianópolis")).toEqual({
      offers: [],
      skipped: 1,
    });
    expect(
      (await ticketmasterSource.fetchOffers("São José")).offers,
    ).toHaveLength(1);
  });

  it("discards cancelled and test events, venues outside every city, and events without a start", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response([
          {
            ...event,
            id: "cancelled",
            dates: { ...event.dates, status: { code: "cancelled" } },
          },
          { ...event, id: "test", test: true },
          {
            ...event,
            id: "sao-paulo",
            _embedded: { venues: [venueAt("-23.5505", "-46.6333")] },
          },
          {
            ...event,
            id: "no-location",
            _embedded: { venues: [{ name: "x" }] },
          },
          {
            ...event,
            id: "tbd",
            dates: { start: {}, status: { code: "onsale" } },
          },
        ]),
      ),
    );

    expect(await ticketmasterSource.fetchOffers("Curitiba")).toEqual({
      offers: [],
      skipped: 5,
    });
  });

  it("fails without leaking the API key when the API errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );

    const error = await ticketmasterSource
      .fetchOffers("Curitiba")
      .catch((caught: Error) => caught);

    expect(error).toEqual(
      new Error("Ticketmaster returned HTTP 401 for Curitiba, page 1"),
    );
    expect((error as Error).message).not.toContain("secret-key");
  });

  it("fails loudly when the API key is not set", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "");

    await expect(ticketmasterSource.fetchOffers("Curitiba")).rejects.toThrow(
      "TICKETMASTER_API_KEY is not set",
    );
  });
});
