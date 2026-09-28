import { describe, expect, it } from "vitest";
import {
  getSearchTerm,
  getSelectedPeriod,
  getSelectedSources,
} from "./offer-filters";

describe("offer filters", () => {
  it("limits the period to supported windows", () => {
    expect(getSelectedPeriod("7")).toBe(7);
    expect(getSelectedPeriod("90")).toBe(90);
    expect(getSelectedPeriod("365")).toBe(30);
  });

  it("normalizes search input from the URL", () => {
    expect(getSearchTerm(["  Jazz  ", "ignored"])).toBe("Jazz");
    expect(getSearchTerm("x".repeat(150))).toHaveLength(100);
  });

  it("keeps only available sources from repeated URL parameters", () => {
    expect(
      getSelectedSources(
        ["meaple", "unknown", "sympla", "meaple"],
        ["sympla", "meaple"],
      ),
    ).toEqual(["sympla", "meaple"]);
    expect(getSelectedSources("unknown", ["sympla"])).toEqual([]);
    expect(getSelectedSources(undefined, ["sympla"])).toEqual([]);
  });
});
