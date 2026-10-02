import type { Municipality } from "./municipalities";

/**
 * The Covered Cities: the listings the agenda shows. Each one absorbs the
 * nearby municipalities mapped to it in `COVERED_CITY_BY_MUNICIPALITY`, so
 * `offers.city` always holds one of these names. Text column, not a Postgres
 * enum, for the same reason as `MUNICIPALITIES`.
 */
export const COVERED_CITIES = [
  "Joinville",
  "Balneário Camboriú",
  "Florianópolis",
  "Curitiba",
] as const;

export type CoveredCity = (typeof COVERED_CITIES)[number];

/** The Covered City whose listing each collected municipality belongs to. */
export const COVERED_CITY_BY_MUNICIPALITY: Record<Municipality, CoveredCity> = {
  Joinville: "Joinville",
  "Jaraguá do Sul": "Joinville",
  Itajaí: "Balneário Camboriú",
  "Balneário Camboriú": "Balneário Camboriú",
  Florianópolis: "Florianópolis",
  "São José": "Florianópolis",
  Curitiba: "Curitiba",
};
