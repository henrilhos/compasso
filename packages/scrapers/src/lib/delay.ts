/** Resolves after `ms` milliseconds — used to space out sequential requests. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
