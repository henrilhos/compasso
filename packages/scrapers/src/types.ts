import type { CoveredCity } from "@repo/db";
import type { RawOffer } from "./lib/validation";

export interface FetchOffersResult {
  offers: RawOffer[];
  /** Offers discarded during mapping or validation — not fatal, see #3. */
  skipped: number;
}

export interface OfferSource {
  /** Stable identifier stored in the `offers.source` column. */
  id: string;
  name: string;
  fetchOffers(city: CoveredCity): Promise<FetchOffersResult>;
}
