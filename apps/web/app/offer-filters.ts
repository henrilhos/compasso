export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodFilter = (typeof PERIOD_OPTIONS)[number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getSelectedPeriod(
  value: string | string[] | undefined,
): PeriodFilter {
  const candidate = first(value);
  if (candidate === "7") return 7;
  if (candidate === "90") return 90;
  return 30;
}

export function getSearchTerm(value: string | string[] | undefined) {
  return (first(value) ?? "").trim().slice(0, 100);
}

export function getSelectedSources(
  value: string | string[] | undefined,
  availableSources: string[],
) {
  const candidates = new Set(value === undefined ? [] : [value].flat());
  return availableSources.filter((source) => candidates.has(source));
}
