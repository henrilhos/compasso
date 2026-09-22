import { COVERED_CITIES, type CoveredCity } from "@repo/db";

export type CityFilter = CoveredCity | "all";

export function getSelectedCity(
  value: string | string[] | undefined,
): CityFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === "all") return "all";
  if (candidate && COVERED_CITIES.includes(candidate as CoveredCity)) {
    return candidate as CoveredCity;
  }

  return "Joinville";
}
