import { COVERED_CITIES, type CoveredCity } from "@repo/db";

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Aliases beyond the normalized canonical name itself, keyed normalized.
const ALIASES: Record<string, CoveredCity> = {
  bc: "Balneário Camboriú",
  "balneario camboriu": "Balneário Camboriú",
  floripa: "Florianópolis",
  jaragua: "Jaraguá do Sul",
};

const BY_NORMALIZED_NAME: Record<string, CoveredCity> = Object.fromEntries(
  COVERED_CITIES.map((city) => [normalize(city), city]),
);

/**
 * Resolves a raw, source-provided city string to a Covered City, or
 * `undefined` if it doesn't match one — the caller should discard the
 * offer in that case (see #3: feeds are regional and leak neighboring
 * cities, neighborhoods, and even other states).
 */
export function resolveCoveredCity(rawCity: string): CoveredCity | undefined {
  const normalized = normalize(rawCity);
  if (!normalized) {
    return undefined;
  }

  return ALIASES[normalized] ?? BY_NORMALIZED_NAME[normalized];
}
