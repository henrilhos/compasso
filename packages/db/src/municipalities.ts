/**
 * The closed list of municipalities the Compasso agenda collects. Text
 * column, not a Postgres enum (see ADR-0001 discussion in issue #5) — the
 * list is meant to grow and enums are painful to alter.
 */
export const MUNICIPALITIES = [
  "Joinville",
  "Jaraguá do Sul",
  "Itajaí",
  "Balneário Camboriú",
  "Florianópolis",
  "São José",
  "Curitiba",
] as const;

export type Municipality = (typeof MUNICIPALITIES)[number];
