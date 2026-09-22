export function detailPageLimit(): number {
  const value = Number(process.env.DETAIL_PAGE_MAX_PER_RUN ?? 100);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 100;
}

export function detailPageIntervalMs(): number {
  const value = Number(process.env.DETAIL_PAGE_MIN_INTERVAL_MS ?? 1_000);
  return Number.isFinite(value) && value >= 0 ? value : 1_000;
}
