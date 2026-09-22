export type CulturalEventFilter = "all" | "cultural" | "not_cultural";

export function getSelectedCulturalEventFilter(
  value: string | string[] | undefined,
): CulturalEventFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === "cultural" || candidate === "not_cultural") {
    return candidate;
  }

  return "all";
}
