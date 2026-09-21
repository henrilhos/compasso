export interface RawOffer {
  /** Unique id of the offer within its source, used for dedupe on upsert. */
  sourceOfferId: string;
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

export interface OfferSource {
  /** Stable identifier stored in the `offers.source` column. */
  id: string;
  name: string;
  fetchOffers(): Promise<RawOffer[]>;
}
