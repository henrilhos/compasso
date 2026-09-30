import { describe, expect, it } from "vitest";

import { getSelectedNoveltyFilter } from "./novelty-filter";

describe("getSelectedNoveltyFilter", () => {
  it("defaults to all when no filter is selected", () => {
    expect(getSelectedNoveltyFilter(undefined)).toBe("all");
  });

  it("accepts the new option", () => {
    expect(getSelectedNoveltyFilter("new")).toBe("new");
  });

  it("falls back to all for an unknown value", () => {
    expect(getSelectedNoveltyFilter("nonsense")).toBe("all");
  });

  it("uses the first query value when the parameter is repeated", () => {
    expect(getSelectedNoveltyFilter(["new", "all"])).toBe("new");
  });
});
