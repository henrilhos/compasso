import { MUNICIPALITIES, type Municipality } from "@repo/db";

export type CityFilter = Municipality[];

export function getSelectedCities(
  value: string | string[] | undefined,
): CityFilter {
  const candidates = new Set(value === undefined ? [] : [value].flat());

  return MUNICIPALITIES.filter((city) => candidates.has(city));
}
