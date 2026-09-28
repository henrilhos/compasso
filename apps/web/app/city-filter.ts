import { COVERED_CITIES, type CoveredCity } from "@repo/db";

export type CityFilter = CoveredCity[];

export function getSelectedCities(
  value: string | string[] | undefined,
): CityFilter {
  const candidates = new Set(value === undefined ? [] : [value].flat());

  return COVERED_CITIES.filter((city) => candidates.has(city));
}
