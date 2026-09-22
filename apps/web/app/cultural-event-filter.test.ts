import { describe, expect, it } from "vitest";

import { getSelectedCulturalEventFilter } from "./cultural-event-filter";

describe("getSelectedCulturalEventFilter", () => {
  it("defaults to all when no filter is selected", () => {
    expect(getSelectedCulturalEventFilter(undefined)).toBe("all");
  });

  it("accepts the cultural option", () => {
    expect(getSelectedCulturalEventFilter("cultural")).toBe("cultural");
  });

  it("accepts the not_cultural option", () => {
    expect(getSelectedCulturalEventFilter("not_cultural")).toBe("not_cultural");
  });

  it("falls back to all for an unknown value", () => {
    expect(getSelectedCulturalEventFilter("nonsense")).toBe("all");
  });

  it("uses the first query value when the parameter is repeated", () => {
    expect(getSelectedCulturalEventFilter(["cultural", "not_cultural"])).toBe(
      "cultural",
    );
  });
});
