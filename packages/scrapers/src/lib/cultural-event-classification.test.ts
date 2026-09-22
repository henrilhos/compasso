import { describe, expect, it, vi } from "vitest";

import {
  classifyCulturalEvents,
  type CulturalEventClassification,
  type CulturalEventClassificationStore,
} from "./cultural-event-classification";

function store(overrides: Partial<CulturalEventClassificationStore> = {}) {
  return {
    listCandidates: vi.fn(async () => []),
    applyClassification: vi.fn(async () => {}),
    ...overrides,
  } satisfies CulturalEventClassificationStore;
}

function systemOneResponse(noul: number) {
  return new Response(
    JSON.stringify({
      answers: { is_cultural_event: { type: "noul", noul } },
    }),
    { status: 200 },
  );
}

describe("classifyCulturalEvents", () => {
  it("sends the offer's title and description and applies the threshold", async () => {
    const applyClassification = vi.fn(
      async (_id: string, _result: CulturalEventClassification) => {},
    );
    const repository = store({
      listCandidates: vi.fn(async () => [
        {
          id: "sympla:1",
          title: "Show da banda X",
          description: "Rock ao vivo",
        },
      ]),
      applyClassification,
    });
    const fetchPage = vi.fn(async (_url: string, _init?: RequestInit) =>
      systemOneResponse(0.87),
    );

    await classifyCulturalEvents({ repository, apiKey: "secret", fetchPage });

    expect(fetchPage).toHaveBeenCalledWith(
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
    const [, init] = fetchPage.mock.calls[0]!;
    const body = JSON.parse(init!.body as string);
    expect(body.state).toBe("Show da banda X\n\nRock ao vivo");
    const [, result] = applyClassification.mock.calls[0]!;
    expect(result).toMatchObject({ isCulturalEvent: true });
    expect(result.confidence).toBeCloseTo(0.74);
  });

  it("reads a noul score at or below the threshold as false", async () => {
    const applyClassification = vi.fn(
      async (_id: string, _result: CulturalEventClassification) => {},
    );
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "sympla:2", title: "Feira de negócios" },
      ]),
      applyClassification,
    });
    const fetchPage = vi.fn(async () => systemOneResponse(0.2));

    await classifyCulturalEvents({ repository, apiKey: "secret", fetchPage });

    const [, result] = applyClassification.mock.calls[0]!;
    expect(result).toMatchObject({ isCulturalEvent: false });
    expect(result.confidence).toBeCloseTo(0.6);
  });

  it("does not let one failed classification stop the rest", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "sympla:1", title: "A" },
        { id: "sympla:2", title: "B" },
      ]),
    });
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(systemOneResponse(0.9));

    await classifyCulturalEvents({ repository, apiKey: "secret", fetchPage });

    expect(repository.applyClassification).toHaveBeenCalledTimes(1);
    expect(repository.applyClassification).toHaveBeenCalledWith(
      "sympla:2",
      expect.objectContaining({ isCulturalEvent: true }),
    );
  });

  it("limits the run to maxItems candidates", async () => {
    const repository = store({
      listCandidates: vi.fn(async () => [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ]),
    });
    const fetchPage = vi.fn(async () => systemOneResponse(0.9));

    await classifyCulturalEvents({
      repository,
      apiKey: "secret",
      fetchPage,
      maxItems: 1,
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(repository.applyClassification).toHaveBeenCalledTimes(1);
  });
});
