import { describe, expect, it } from "vitest";

import { getSelectedCities } from "./city-filter";

describe("getSelectedCities", () => {
  it("uses all cities when none is selected", () => {
    expect(getSelectedCities(undefined)).toEqual([]);
  });

  it("accepts a covered city from the query string", () => {
    expect(getSelectedCities("Florianópolis")).toEqual(["Florianópolis"]);
  });

  it("ignores unknown cities and the old all value", () => {
    expect(getSelectedCities("Pomerode")).toEqual([]);
    expect(getSelectedCities(["all", "Itajaí"])).toEqual(["Itajaí"]);
  });

  it("keeps covered cities from repeated parameters without duplicates", () => {
    expect(getSelectedCities(["Itajaí", "Pomerode", "Joinville", "Itajaí"])).toEqual([
      "Joinville",
      "Itajaí",
    ]);
  });
});
