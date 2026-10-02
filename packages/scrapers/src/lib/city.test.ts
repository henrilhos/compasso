import { describe, expect, it } from "vitest";
import { resolveMunicipality } from "./city";

describe("resolveMunicipality", () => {
  it("resolves an exact canonical name", () => {
    expect(resolveMunicipality("Joinville")).toBe("Joinville");
    expect(resolveMunicipality("Curitiba")).toBe("Curitiba");
  });

  it("is case- and accent-insensitive", () => {
    expect(resolveMunicipality("joinville")).toBe("Joinville");
    expect(resolveMunicipality("FLORIANOPOLIS")).toBe("Florianópolis");
    expect(resolveMunicipality("itajai")).toBe("Itajaí");
  });

  it("ignores punctuation and extra whitespace", () => {
    expect(resolveMunicipality("  São José!  ")).toBe("São José");
  });

  it("resolves known aliases", () => {
    expect(resolveMunicipality("bc")).toBe("Balneário Camboriú");
    expect(resolveMunicipality("balneario camboriu")).toBe(
      "Balneário Camboriú",
    );
    expect(resolveMunicipality("floripa")).toBe("Florianópolis");
    expect(resolveMunicipality("jaragua")).toBe("Jaraguá do Sul");
  });

  it("returns undefined for a city outside the covered list", () => {
    expect(resolveMunicipality("Pomerode")).toBeUndefined();
    expect(resolveMunicipality("Dublin")).toBeUndefined();
  });

  it("returns undefined for a neighborhood, not a city", () => {
    expect(resolveMunicipality("Centro")).toBeUndefined();
    expect(resolveMunicipality("Batel")).toBeUndefined();
  });

  it("returns undefined for empty or missing input", () => {
    expect(resolveMunicipality("")).toBeUndefined();
    expect(resolveMunicipality("   ")).toBeUndefined();
  });
});
