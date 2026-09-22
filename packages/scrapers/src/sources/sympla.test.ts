import { describe, expect, it } from "vitest";
import { parseSymplaSearchResult } from "./sympla";

function flightScript(value: unknown): string {
  return `<script>self.__next_f.push([1,${JSON.stringify(
    JSON.stringify(value),
  )}])</script>`;
}

describe("parseSymplaSearchResult", () => {
  it("decodes a Next Flight payload and extracts the search result", () => {
    const event = {
      id: 3585094,
      name: "Nocaute [Open Bar]",
      url: "https://www.sympla.com.br/evento/nocaute/3585094",
      start_date: "2026-09-27T02:00:00+00:00",
      location: { city: "Joinville" },
    };
    const payload = {
      searchDataResult: {
        data: [event],
        total: 25,
        limit: 24,
        page: 1,
      },
    };

    const result = parseSymplaSearchResult(
      [flightScript({ before: true }), flightScript(payload)].join(""),
    );

    expect(result).toEqual({
      data: [event],
      total: 25,
      limit: 24,
      page: 1,
    });
  });

  it("fails clearly when the page is not a normal Sympla HTML response", () => {
    expect(() => parseSymplaSearchResult("<html></html>")).toThrow(
      "search result was not found",
    );
  });

  it("extracts the city landing page payload", () => {
    const event = {
      id: 3465310,
      name: "CUPOLA Aluguel Day",
      location: { city: "Curitiba" },
    };
    const payload = {
      dataSectionMoreEvents: {
        data: [event],
        total: 561,
        limit: 16,
        page: 1,
      },
    };

    expect(
      parseSymplaSearchResult(
        [flightScript({ before: true }), flightScript(payload)].join(""),
      ),
    ).toEqual(payload.dataSectionMoreEvents);
  });

  it("extracts a search result from a raw RSC stream", () => {
    const payload = {
      searchDataResult: {
        data: [],
        total: 0,
        limit: 24,
        page: 2,
      },
    };

    expect(parseSymplaSearchResult(`2d:${JSON.stringify(payload)}\n`)).toEqual(
      payload.searchDataResult,
    );
  });
});
