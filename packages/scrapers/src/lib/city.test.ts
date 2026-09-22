import { describe, expect, it } from "vitest";
import { resolveCoveredCity } from "./city";

describe("resolveCoveredCity", () => {
  it("resolves an exact canonical name", () => {
    expect(resolveCoveredCity("Joinville")).toBe("Joinville");
  });

  it("is case- and accent-insensitive", () => {
    expect(resolveCoveredCity("joinville")).toBe("Joinville");
    expect(resolveCoveredCity("FLORIANOPOLIS")).toBe("Florianópolis");
    expect(resolveCoveredCity("itajai")).toBe("Itajaí");
  });

  it("ignores punctuation and extra whitespace", () => {
    expect(resolveCoveredCity("  São José!  ")).toBe("São José");
  });

  it("resolves known aliases", () => {
    expect(resolveCoveredCity("bc")).toBe("Balneário Camboriú");
    expect(resolveCoveredCity("balneario camboriu")).toBe(
      "Balneário Camboriú",
    );
    expect(resolveCoveredCity("floripa")).toBe("Florianópolis");
    expect(resolveCoveredCity("jaragua")).toBe("Jaraguá do Sul");
  });

  it("returns undefined for a city outside the covered list", () => {
    expect(resolveCoveredCity("Pomerode")).toBeUndefined();
    expect(resolveCoveredCity("Curitiba")).toBeUndefined();
    expect(resolveCoveredCity("Dublin")).toBeUndefined();
  });

  it("returns undefined for a neighborhood, not a city", () => {
    expect(resolveCoveredCity("Centro")).toBeUndefined();
    expect(resolveCoveredCity("Batel")).toBeUndefined();
  });

  it("returns undefined for empty or missing input", () => {
    expect(resolveCoveredCity("")).toBeUndefined();
    expect(resolveCoveredCity("   ")).toBeUndefined();
  });
});
