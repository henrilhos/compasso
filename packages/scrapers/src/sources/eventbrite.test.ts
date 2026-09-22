import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEventbriteSearchResponse, eventbriteSource } from "./eventbrite";

const event = {
  id: "123456",
  name: "Festa em Joinville",
  summary: "Uma festa",
  url: "https://www.eventbrite.com.br/e/festa-123456",
  image: { url: "https://img.evbuc.com/festa.jpg" },
  primary_venue: {
    name: "Arena Joinville",
    address: {
      city: "Centro",
      localized_address_display: "Rua das Flores, Joinville, SC 89201-000",
    },
  },
  start_date: "2026-10-10",
  start_time: "21:00:00",
  end_date: "2026-10-11",
  end_time: "02:00:00",
  timezone: "America/Sao_Paulo",
};

const leakedEvent = {
  ...event,
  id: "999999",
  primary_venue: {
    ...event.primary_venue,
    address: {
      city: "Joinville",
      localized_address_display: "Rua XV, Curitiba, PR 80000-000",
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseEventbriteSearchResponse", () => {
  it("extracts events and pagination from the destination response", () => {
    expect(
      parseEventbriteSearchResponse({
        events: {
          results: [event],
          pagination: { page_number: 1, page_count: 2 },
        },
      }),
    ).toEqual({
      items: [event],
      hasNextPage: true,
    });
  });
});

describe("eventbriteSource", () => {
  it("performs the CSRF handshake and maps a covered event", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html>", {
          headers: { "set-cookie": "csrftoken=csrf-token; Path=/" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          events: {
            results: [event, leakedEvent],
            pagination: { page_number: 1, page_count: 1 },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await eventbriteSource.fetchOffers("Joinville");

    expect(result).toEqual({
      skipped: 1,
      offers: [
        {
          sourceOfferId: "123456",
          title: "Festa em Joinville",
          description: "Uma festa",
          url: "https://www.eventbrite.com.br/e/festa-123456",
          imageUrl: "https://img.evbuc.com/festa.jpg",
          venueName: "Arena Joinville",
          address: "Rua das Flores, Joinville, SC 89201-000",
          city: "Joinville",
          startsAt: new Date("2026-10-11T00:00:00.000Z"),
          endsAt: new Date("2026-10-11T05:00:00.000Z"),
        },
      ],
    });

    const [, postInit] = fetchMock.mock.calls[1] ?? [];
    const headers = new Headers(postInit?.headers);
    expect(headers.get("X-CSRFToken")).toBe("csrf-token");
    expect(headers.get("Cookie")).toBe("csrftoken=csrf-token");
    expect(JSON.parse(String(postInit?.body))).toMatchObject({
      event_search: {
        places: ["101964301"],
        page: 1,
        page_size: 50,
      },
    });
  });
});
