import { describe, expect, it } from "vitest";
import {
  getSearchTerm,
  getSelectedPeriod,
  getSelectedSource,
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

  it("only accepts sources currently available", () => {
    expect(getSelectedSource("sympla", ["sympla", "meaple"])).toBe("sympla");
    expect(getSelectedSource("unknown", ["sympla"])).toBe("all");
  });
});
