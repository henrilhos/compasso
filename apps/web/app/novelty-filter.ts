export type NoveltyFilter = "all" | "new";

export function getSelectedNoveltyFilter(
  value: string | string[] | undefined,
): NoveltyFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === "new" ? "new" : "all";
}
