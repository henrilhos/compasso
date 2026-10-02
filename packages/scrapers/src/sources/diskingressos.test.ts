import { afterEach, describe, expect, it, vi } from "vitest";
import {
  diskIngressosSource,
  parseDiskIngressosSearchResponse,
} from "./diskingressos";
import searchResponse from "./fixtures/diskingressos-search.json";

// A slice of a real `_search` response (2026-10-02): a Curitiba event and a
// group that share the numeric id 3416, a group already running, an event
// with an uppercase city, an event with a blank city, and a Florianópolis
// event.
const hits = searchResponse.hits.hits;
const [event, group, runningGroup, uppercaseCity, blankCity, florianopolis] =
  hits.map((hit) => hit._source);

function response(sources: unknown[], total = sources.length) {
  return Response.json({
    hits: { total, hits: sources.map((_source) => ({ _source })) },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function fetchOffers(
  city: Parameters<typeof diskIngressosSource.fetchOffers>[0],
) {
  const promise = diskIngressosSource.fetchOffers(city);
  await vi.runAllTimersAsync();
  return promise;
}

function stubFetch(...responses: Response[]) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T15:00:00.000Z"));
  const fetchMock = vi.fn();
  for (const next of responses) fetchMock.mockResolvedValueOnce(next);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("parseDiskIngressosSearchResponse", () => {
  it("pages by the offset reached against the reported total", () => {
    const parsed = (hitCount: number, total: number, from: number) =>
      parseDiskIngressosSearchResponse(
        {
          hits: {
            total,
            hits: Array.from({ length: hitCount }, () => ({ _source: {} })),
          },
        },
        from,
      ).hasNextPage;

    expect(parsed(500, 700, 0)).toBe(true);
    expect(parsed(200, 700, 500)).toBe(false);
  });

  it("rejects an unexpected response rather than treating it as empty", () => {
    expect(() => parseDiskIngressosSearchResponse({ hits: {} }, 0)).toThrow(
      "Disk Ingressos response has an unexpected shape",
    );
  });
});

describe("diskIngressosSource", () => {
  it("posts the site's own search, asking for events that are still on sale", async () => {
    const fetchMock = stubFetch(response([]));

    await fetchOffers("Curitiba");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://www.diskingressos.com.br/home/_search?size=500&from=0",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      query: { bool: { must: [{ range: { finalsale: { gte: "now" } } }] } },
      sort: [{ data: { order: "asc" } }],
    });
  });

  it("maps an event, with its HTML description as readable text", async () => {
    stubFetch(response([uppercaseCity]));

    const result = await fetchOffers("Curitiba");

    expect(result.skipped).toBe(0);
    expect(result.offers).toEqual([
      {
        sourceOfferId: "4028-E",
        title: uppercaseCity?.eventname.trim(),
        description:
          "O Baile Zum Zum Zum é o show festa escolhido para comemorar o Dia das Crianças.\nA Banda Teatro Tupi Pererê vai tocar e cantar o cancioneiro popular, MPB e as canções autorais.",
        url: "https://www.diskingressos.com.br/evento/4028/2026-10-12/pr/curitiba/4028",
        imageUrl:
          "https://www.diskingressos.com.br/images/cache/events/4028.webp",
        venueName: uppercaseCity?.local.trim(),
        city: "Curitiba",
        startsAt: new Date("2026-10-12T19:00:00.000Z"),
      },
    ]);
  });

  it("keeps paragraph breaks from the description", async () => {
    stubFetch(
      response([
        { ...uppercaseCity, description: "<p>Um.</p><p>Dois<br>três</p>" },
      ]),
    );

    const [offer] = (await fetchOffers("Curitiba")).offers;

    expect(offer?.description).toBe("Um.\n\nDois\ntrês");
  });

  it("keeps an event and a group that share a numeric id as two offers", async () => {
    stubFetch(response([event, group]));

    const { offers } = await fetchOffers("Curitiba");

    expect(offers.map((offer) => offer.sourceOfferId)).toEqual([
      "3416-E",
      "3416-G",
    ]);
    expect(offers.map((offer) => offer.url)).toEqual([
      "https://www.diskingressos.com.br/evento/3416/2026-10-10/pr/curitiba/3416",
      "https://www.diskingressos.com.br/grupo/3416/2026-11-06/pr/curitiba/3416",
    ]);
  });

  it("keeps a group that is already running, ending when its sales close, and drops its keyword description", async () => {
    stubFetch(response([runningGroup]));

    const { offers } = await fetchOffers("Curitiba");

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      sourceOfferId: "2601-G",
      startsAt: new Date("2026-09-30T03:00:00.000Z"),
      endsAt: new Date("2026-11-01T01:00:00.000Z"),
    });
    expect(offers[0]?.description).toBeUndefined();
  });

  it("keeps only the requested municipality and skips other and blank cities", async () => {
    stubFetch(response([event, florianopolis, blankCity]));

    const result = await fetchOffers("Florianópolis");

    expect(result.offers.map((offer) => offer.city)).toEqual([
      "Florianópolis",
    ]);
    expect(result.offers[0]?.url).toBe(
      "https://www.diskingressos.com.br/evento/3647/2026-12-15/sc/florianopolis/3647",
    );
    expect(result.skipped).toBe(2);
  });

  it("excludes events that already ended and events starting beyond the window", async () => {
    stubFetch(
      response([
        { ...event, uid: "past-E", data: "2026-10-01T22:00:00.000Z" },
        { ...event, uid: "future-E", data: "2027-02-10T22:00:00.000Z" },
        { ...event, uid: "within-E" },
      ]),
    );

    const result = await fetchOffers("Curitiba");

    expect(result.skipped).toBe(2);
    expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual([
      "within-E",
    ]);
  });

  it("discards malformed items without losing the rest", async () => {
    stubFetch(
      response([
        { ...event, uid: "no-date-E", data: undefined },
        { ...event, uid: "bad-date-E", data: "not a date" },
        { ...event, uid: "no-title-E", eventname: " " },
        { ...event, uid: undefined },
        "not an object",
        event,
      ]),
    );

    const result = await fetchOffers("Curitiba");

    expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual([
      "3416-E",
    ]);
    expect(result.skipped).toBe(5);
  });

  it("pages with an offset until the reported total is reached", async () => {
    const fetchMock = stubFetch(response([event], 501), response([group], 501));

    const result = await fetchOffers("Curitiba");

    expect(result.offers).toHaveLength(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://www.diskingressos.com.br/home/_search?size=500&from=0",
      "https://www.diskingressos.com.br/home/_search?size=500&from=500",
    ]);
  });

  it.each([403, 429])(
    "fails with a clear message, without working around it, on HTTP %i",
    async (status) => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("blocked", { status }));
      vi.stubGlobal("fetch", fetchMock);

      const promise = diskIngressosSource.fetchOffers("Curitiba");
      const assertion = expect(promise).rejects.toThrow(
        `Disk Ingressos blocked the collector (HTTP ${status}); not working around it, see docs/adr/0006-disk-ingressos-sem-contornar-bloqueio.md`,
      );
      await vi.runAllTimersAsync();
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("fails with a clear message when the queue answers instead of the API", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Queue-Fair</html>", { status: 200 }),
        ),
    );

    const promise = diskIngressosSource.fetchOffers("Curitiba");
    const assertion = expect(promise).rejects.toThrow(
      "Disk Ingressos did not answer with JSON (queue?); not working around it, see docs/adr/0006-disk-ingressos-sem-contornar-bloqueio.md",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});
