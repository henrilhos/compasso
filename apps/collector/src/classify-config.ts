/** Unset (the default) means the run works through every candidate. */
export function culturalEventClassificationLimit(): number {
  const value = Number(process.env.CULTURAL_EVENT_MAX_PER_RUN);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : Infinity;
}

export function typesafeAiApiKey(): string {
  const value = process.env.TYPESAFE_AI_API_KEY;
  if (!value) {
    throw new Error("TYPESAFE_AI_API_KEY environment variable is not set");
  }
  return value;
}
