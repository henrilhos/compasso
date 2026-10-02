import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blueticketSource, parseBlueticketEventsResponse } from "./blueticket";

// Real items from `GET /events`, kept as the API returned them.
const feed: Record<string, unknown>[] = JSON.parse(
  readFileSync(
    new URL("./fixtures/blueticket-events.json", import.meta.url),
    "utf8",
  ),
);

function feedItem(id: number) {
  const item = feed.find((event) => event.id === id);
  if (!item) throw new Error(`fixture has no event ${id}`);
  return item;
}

const FLORIANOPOLIS_TODAY = feedItem(41579); // 2026-10-02 19:30, Florianópolis/SC
const CURITIBA = feedItem(41668); // 2026-10-02 22:00, Curitiba/PR
const BALNEARIO = feedItem(41063); // 2026-10-10 15:00, Balneário Camboriú/SC
const ITAJAI = feedItem(41625); // 2026-10-03 19:00, Itajaí/SC
const BEYOND_WINDOW = feedItem(41423); // 2027-01-01, Florianópolis/SC
const CAMBORIU = feedItem(41806); // Camboriú/SC, not a Municipality
const RIO_PRETO = feedItem(41868); // São José do Rio Preto/SP

// 12:00 in Brasília.
const NOW = new Date("2026-10-02T15:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubFeed(events: unknown) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const fetchMock = vi.fn(async () => Response.json(events));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fetchOffers(
  city: Parameters<typeof blueticketSource.fetchOffers>[0],
) {
  const promise = blueticketSource.fetchOffers(city);
  await vi.runAllTimersAsync();
  return promise;
}

describe("parseBlueticketEventsResponse", () => {
  it("rejects a response that is not an array rather than treating it as empty", () => {
    expect(() => parseBlueticketEventsResponse({ events: [] })).toThrow(
      "Blueticket response has an unexpected shape",
    );
  });
});

describe("blueticketSource", () => {
  it("maps an event and reads `date` as Brasília time", async () => {
    const fetchMock = stubFeed([FLORIANOPOLIS_TODAY]);

    const result = await fetchOffers("Florianópolis");

    expect(result).toEqual({
      offers: [
        {
          sourceOfferId: "41579",
          title:
            "Pearl Jam Symphonic em Florianópolis com Black Circle e Orquestra",
          url: "https://www.blueticket.com.br/evento/41579",
          imageUrl:
            "https://cdn.blueticket.com.br/images/imagens/full/yxMwLIHLvnaDxrJsRBgNcP1Fg7OaRcUqTs31uQ8I.jpeg",
          venueName: "Teatro Ademir Rosa - CIC",
          city: "Florianópolis",
          // 19:30 in Brasília is 22:30 UTC, not 19:30 UTC.
          startsAt: new Date("2026-10-02T22:30:00.000Z"),
        },
      ],
      skipped: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api2-cdn.blueticket.com.br/events",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("returns only the requested Municipality from the national feed", async () => {
    stubFeed(feed);

    const curitiba = await fetchOffers("Curitiba");
    const balneario = await fetchOffers("Balneário Camboriú");
    const itajai = await fetchOffers("Itajaí");

    expect(curitiba.offers.map((offer) => offer.sourceOfferId)).toEqual([
      String(CURITIBA.id),
    ]);
    expect(balneario.offers.map((offer) => offer.sourceOfferId)).toEqual([
      String(BALNEARIO.id),
    ]);
    expect(itajai.offers.map((offer) => offer.sourceOfferId)).toEqual([
      String(ITAJAI.id),
    ]);
  });

  it("discards events outside every Municipality without erroring", async () => {
    stubFeed([CAMBORIU, RIO_PRETO]);

    for (const city of ["São José", "Balneário Camboriú"] as const) {
      expect(await fetchOffers(city)).toEqual({ offers: [], skipped: 2 });
    }
  });

  it("does not take a same-named city in another state", async () => {
    stubFeed([{ ...CURITIBA, cityState: "SP" }]);

    expect(await fetchOffers("Curitiba")).toEqual({ offers: [], skipped: 1 });
  });

  it("excludes events beyond the 90-day window", async () => {
    stubFeed([BEYOND_WINDOW, FLORIANOPOLIS_TODAY]);

    const result = await fetchOffers("Florianópolis");

    expect(result.skipped).toBe(1);
    expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual([
      "41579",
    ]);
  });

  it("excludes events that already started", async () => {
    stubFeed([{ ...FLORIANOPOLIS_TODAY, date: "2026-10-02 11:59:00" }]);

    expect(await fetchOffers("Florianópolis")).toEqual({
      offers: [],
      skipped: 1,
    });
  });

  it("discards cancelled events", async () => {
    stubFeed([
      { ...FLORIANOPOLIS_TODAY, cancellationDate: "2026-09-17 16:54:44" },
    ]);

    expect(await fetchOffers("Florianópolis")).toEqual({
      offers: [],
      skipped: 1,
    });
  });

  it("discards a malformed event and keeps the rest", async () => {
    stubFeed([
      { ...FLORIANOPOLIS_TODAY, id: 2, date: "not a date" },
      { ...FLORIANOPOLIS_TODAY, id: 3, name: "" },
      FLORIANOPOLIS_TODAY,
    ]);

    const result = await fetchOffers("Florianópolis");

    expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual([
      "41579",
    ]);
    expect(result.skipped).toBe(2);
  });

  it("accepts an offer with no description", async () => {
    stubFeed([FLORIANOPOLIS_TODAY]);

    const [offer] = (await fetchOffers("Florianópolis")).offers;

    expect(offer?.description).toBeUndefined();
  });

  it("fails the city when the API errors, so the collector can report it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    const promise = blueticketSource.fetchOffers("Curitiba");
    const assertion = expect(promise).rejects.toThrow(
      "Blueticket returned HTTP 503 for Curitiba",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});
