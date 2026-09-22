import { describe, expect, it, vi } from "vitest";

import {
  enrichDescriptions,
  extractDetailDescription,
  needsDescriptionEnrichment,
  normalizeDetailUrl,
  type DescriptionEnrichmentStore,
} from "./description-enrichment";

function store(overrides: Partial<DescriptionEnrichmentStore> = {}) {
  return {
    listCandidates: vi.fn(async () => []),
    getPage: vi.fn(async () => undefined),
    savePage: vi.fn(async () => {}),
    applyDescription: vi.fn(async () => {}),
    ...overrides,
  } satisfies DescriptionEnrichmentStore;
}

describe("normalizeDetailUrl", () => {
  it("removes tracking parameters but preserves event parameters", () => {
    expect(
      normalizeDetailUrl(
        "https://example.com/event?id=123&utm_source=newsletter&fbclid=x&session=abc",
      ),
    ).toBe("https://example.com/event?id=123&session=abc");
  });
});

describe("needsDescriptionEnrichment", () => {
  it("preserves a listing description and permits a new URL after detail text", () => {
    expect(needsDescriptionEnrichment("listing")).toBe(false);
    expect(needsDescriptionEnrichment("detail")).toBe(true);
    expect(needsDescriptionEnrichment(null)).toBe(true);
  });
});

describe("extractDetailDescription", () => {
  it("falls back to the meta description even without an Event og:type or microdata", () => {
    // Reproduces a real Blumie detail page: no JSON-LD script tag or
    // description section in the static HTML, og:type is "website", and
    // the event text only lives in the static meta description.
    const html = `
      <html>
        <head>
          <meta property="og:type" content="website" />
          <meta name="description" content="VENHA DE FANTASIA!! Show da Chococorn." />
        </head>
        <body></body>
      </html>
    `;

    expect(extractDetailDescription(html)).toBe(
      "VENHA DE FANTASIA!! Show da Chococorn.",
    );
  });
});

describe("enrichDescriptions", () => {
  it("uses one successful page result for every offer with the same URL", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "sympla:1", source: "sympla", url: "https://example.com/e?utm_source=x" },
        { id: "sympla:2", source: "sympla", url: "https://example.com/e" },
      ]),
    });
    const fetchPage = vi.fn(async () =>
      new Response('<script type="application/ld+json">{"@type":"Event","description":"<p>Uma festa</p><p>Com bandas.</p>"}</script>'),
    );

    await enrichDescriptions({ repository, fetchPage, minIntervalMs: 0 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(repository.applyDescription).toHaveBeenCalledWith("sympla:1", "Uma festa\n\nCom bandas.");
    expect(repository.applyDescription).toHaveBeenCalledWith("sympla:2", "Uma festa\n\nCom bandas.");
    expect(repository.savePage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "described", description: "Uma festa\n\nCom bandas." }),
    );
  });

  it("records a successful page without event text as definitive", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "pixta:1", source: "pixta", url: "https://example.com/event" },
      ]),
    });

    await enrichDescriptions({
      repository,
      fetchPage: async () => new Response("<main>Site de ingressos</main>"),
      minIntervalMs: 0,
    });

    expect(repository.savePage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_description" }),
    );
    expect(repository.applyDescription).not.toHaveBeenCalled();
  });

  it("does not request definitive URLs and leaves a previous detail text untouched", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "meaple:1", source: "meaple", url: "https://example.com/event" },
      ]),
      getPage: vi.fn(async () => ({ status: "no_description" as const })),
    });
    const fetchPage = vi.fn();

    await enrichDescriptions({ repository, fetchPage, minIntervalMs: 0 });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(repository.applyDescription).not.toHaveBeenCalled();
  });

  it("reuses a cached description for an offer found in a later collection", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "meaple:2", source: "meaple", url: "https://example.com/event" },
      ]),
      getPage: vi.fn(async () => ({
        status: "described" as const,
        description: "Texto já extraído",
      })),
    });
    const fetchPage = vi.fn();

    await enrichDescriptions({ repository, fetchPage, minIntervalMs: 0 });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(repository.applyDescription).toHaveBeenCalledWith(
      "meaple:2",
      "Texto já extraído",
    );
  });

  it("keeps temporary errors eligible and stops blocked URLs on their second collection", async () => {
    const candidates = [
      { id: "eventbrite:1", source: "eventbrite", url: "https://example.com/event" },
    ];
    const first = store({ listCandidates: vi.fn(async () => candidates) });
    await enrichDescriptions({
      repository: first,
      fetchPage: async () => new Response("down", { status: 503 }),
      minIntervalMs: 0,
    });
    expect(first.savePage).toHaveBeenCalledWith(expect.objectContaining({ status: "temporary_failure" }));

    const second = store({
      listCandidates: vi.fn(async () => candidates),
      getPage: vi.fn(async () => ({ status: "blocked" as const, blockedAttempts: 1 })),
    });
    await enrichDescriptions({
      repository: second,
      fetchPage: async () => new Response("blocked", { status: 403 }),
      minIntervalMs: 0,
    });
    expect(second.savePage).toHaveBeenCalledWith(expect.objectContaining({ status: "blocked", blockedAttempts: 2 }));

    const third = store({
      listCandidates: vi.fn(async () => candidates),
      getPage: vi.fn(async () => ({ status: "blocked" as const, blockedAttempts: 2 })),
    });
    const fetchPage = vi.fn();
    await enrichDescriptions({ repository: third, fetchPage, minIntervalMs: 0 });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("counts access blocks across an intervening temporary failure", async () => {
    const candidates = [
      { id: "eventbrite:1", source: "eventbrite", url: "https://example.com/event" },
    ];
    const repository = store({
      listCandidates: vi.fn(async () => candidates),
      getPage: vi.fn(async () => ({ status: "blocked" as const, blockedAttempts: 1 })),
    });

    await enrichDescriptions({
      repository,
      fetchPage: async () => new Response("down", { status: 503 }),
      minIntervalMs: 0,
    });

    expect(repository.savePage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "temporary_failure", blockedAttempts: 1 }),
    );
  });

  it("continues with later URLs when saving one result fails", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "pixta:1", source: "pixta", url: "https://example.com/first" },
        { id: "pixta:2", source: "pixta", url: "https://example.com/second" },
      ]),
      savePage: vi
        .fn()
        .mockRejectedValueOnce(new Error("database unavailable"))
        .mockResolvedValueOnce(undefined),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchPage = vi.fn(async () => new Response("<main>nothing</main>"));

    await enrichDescriptions({ repository, fetchPage, minIntervalMs: 0 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
