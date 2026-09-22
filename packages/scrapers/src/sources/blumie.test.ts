import { afterEach, describe, expect, it, vi } from "vitest";
import { blumieSource, parseBlumieSearchResponse } from "./blumie";

const event = {
  code: "7NMV0KFP3B",
  name: "Festival Blumie",
  bannerUrl: "https://storage.blumie.com.br/festival.jpg",
  city: "Joinville",
  state: "SC",
  locationName: "Zeit Cervejaria",
  days: [
    {
      startDate: "2026-09-26T00:00:00.000Z",
      endDate: "2026-09-26T02:59:00.000Z",
    },
    {
      startDate: "2026-09-27T00:00:00.000Z",
      endDate: "2026-09-27T02:59:00.000Z",
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseBlumieSearchResponse", () => {
  it("extracts events and pagination from the API envelope", () => {
    expect(
      parseBlumieSearchResponse({
        data: {
          events: [event],
          pagination: { page: 1, limit: 40, total: 41, totalPages: 2 },
        },
      }),
    ).toEqual({ items: [event], hasNextPage: true });
  });
});

describe("blumieSource", () => {
  it("maps a multi-day event to one offer and filters leaked cities", async () => {
    const leakedEvent = { ...event, code: "OTHER", city: "Curitiba" };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          events: [event, leakedEvent],
          pagination: { page: 1, limit: 40, total: 2, totalPages: 1 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await blumieSource.fetchOffers("Joinville");

    expect(result).toEqual({
      skipped: 1,
      offers: [
        {
          sourceOfferId: "7NMV0KFP3B",
          title: "Festival Blumie",
          url: "https://blumie.com.br/event/7NMV0KFP3B",
          imageUrl: "https://storage.blumie.com.br/festival.jpg",
          venueName: "Zeit Cervejaria",
          city: "Joinville",
          startsAt: new Date("2026-09-26T00:00:00.000Z"),
          endsAt: new Date("2026-09-27T02:59:00.000Z"),
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.blumie.com.br/api/v1/events/explore?page=1&limit=40&orderBy=recent&city=Joinville",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
