import { describe, expect, it } from "vitest";

import { getSelectedCity } from "./city-filter";

describe("getSelectedCity", () => {
  it("defaults to Joinville when no city is selected", () => {
    expect(getSelectedCity(undefined)).toBe("Joinville");
  });

  it("accepts a covered city from the query string", () => {
    expect(getSelectedCity("Florianópolis")).toBe("Florianópolis");
  });

  it("uses all cities when the all option is selected", () => {
    expect(getSelectedCity("all")).toBe("all");
  });

  it("falls back to Joinville for an unknown city", () => {
    expect(getSelectedCity("Pomerode")).toBe("Joinville");
  });

  it("uses the first query value when the parameter is repeated", () => {
    expect(getSelectedCity(["Itajaí", "Pomerode"])).toBe("Itajaí");
  });
});
