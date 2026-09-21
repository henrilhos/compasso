export interface RawEvent {
  /** Unique id of the event within its source, used for dedupe on upsert. */
  sourceEventId: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  venueName?: string;
  address?: string;
  city: string;
  startsAt: Date;
  endsAt?: Date;
  priceMinCents?: number;
  priceMaxCents?: number;
  currency?: string;
}

export interface EventSource {
  /** Stable identifier stored in the `events.source` column. */
  id: string;
  name: string;
  fetchEvents(): Promise<RawEvent[]>;
}
