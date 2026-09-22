import { afterEach, describe, expect, it, vi } from "vitest";
import { meapleSource, parseMeapleSearchResponse } from "./meaple";

const event = {
  id: "cm-event-1",
  name: "Festa em Joinville",
  slug: "festa-em-joinville",
  startsAt: "2026-10-11T00:00:00.000Z",
  endsAt: "2026-10-11T08:00:00.000Z",
  timezone: "America/Sao_Paulo",
  status: "PUBLISHED",
  canceledAt: null,
  image: { url: "https://files.meaple.com.br/event.jpg" },
  address: {
    street: "Avenida Santos Dumont",
    number: "7770",
    neighborhood: null,
    city: "Joinville",
    state: "Santa Catarina",
    zipCode: "89226-435",
  },
  channel: { slug: "sitio-novo" },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseMeapleSearchResponse", () => {
  it("extracts events and the cursor from the API envelope", () => {
    expect(
      parseMeapleSearchResponse({ events: [event], cursor: "next" }),
    ).toEqual({
      items: [event],
      cursor: "next",
    });
  });

  it("accepts the final page without a cursor", () => {
    expect(parseMeapleSearchResponse({ events: [] })).toEqual({
      items: [],
      cursor: undefined,
    });
  });
});

describe("meapleSource", () => {
  it("maps published events, paginates by cursor, and filters discarded events", async () => {
    vi.useFakeTimers();
    const leakedEvent = {
      ...event,
      id: "leaked",
      address: { ...event.address, city: "Curitiba" },
    };
    const canceledEvent = {
      ...event,
      id: "canceled",
      canceledAt: "2026-01-01T00:00:00.000Z",
    };
    const draftEvent = { ...event, id: "draft", status: "DRAFT" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          events: [event, leakedEvent, canceledEvent, draftEvent],
          cursor: "next",
        }),
      )
      .mockResolvedValueOnce(Response.json({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = meapleSource.fetchOffers("Joinville");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({
      skipped: 3,
      offers: [
        {
          sourceOfferId: "cm-event-1",
          title: "Festa em Joinville",
          url: "https://meaple.com.br/sitio-novo/festa-em-joinville",
          imageUrl: "https://files.meaple.com.br/event.jpg",
          address:
            "Avenida Santos Dumont, 7770, Joinville, Santa Catarina, 89226-435",
          city: "Joinville",
          startsAt: new Date("2026-10-11T00:00:00.000Z"),
          endsAt: new Date("2026-10-11T08:00:00.000Z"),
        },
      ],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.meaple.com.br/v1/events?city=Joinville&limit=50",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.meaple.com.br/v1/events?city=Joinville&limit=50&cursor=next",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
