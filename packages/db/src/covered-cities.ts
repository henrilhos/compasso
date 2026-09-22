/**
 * The closed list of municipalities the Compasso agenda covers. Text
 * column, not a Postgres enum (see ADR-0001 discussion in issue #5) — the
 * list is meant to grow and enums are painful to alter.
 */
export const COVERED_CITIES = [
  "Joinville",
  "Jaraguá do Sul",
  "Itajaí",
  "Balneário Camboriú",
  "Florianópolis",
  "São José",
] as const;

export type CoveredCity = (typeof COVERED_CITIES)[number];
