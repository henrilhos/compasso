export function culturalEventClassificationLimit(): number {
  const value = Number(process.env.CULTURAL_EVENT_MAX_PER_RUN ?? 100);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 100;
}

export function typesafeAiApiKey(): string {
  const value = process.env.TYPESAFE_AI_API_KEY;
  if (!value) {
    throw new Error("TYPESAFE_AI_API_KEY environment variable is not set");
  }
  return value;
}
