import { z } from "zod";
import { MUNICIPALITIES } from "@repo/db";

export const rawOfferSchema = z.object({
  sourceOfferId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  url: z.url(),
  imageUrl: z.url().optional(),
  venueName: z.string().optional(),
  address: z.string().optional(),
  /** The municipality the Source placed the offer in, not its Covered City. */
  city: z.enum(MUNICIPALITIES),
  startsAt: z.date(),
  endsAt: z.date().optional(),
});

export type RawOffer = z.infer<typeof rawOfferSchema>;

export interface ValidationResult {
  offers: RawOffer[];
  skipped: number;
}

function candidateSourceOfferId(candidate: unknown): string {
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "sourceOfferId" in candidate &&
    typeof (candidate as { sourceOfferId: unknown }).sourceOfferId ===
      "string"
  ) {
    return (candidate as { sourceOfferId: string }).sourceOfferId;
  }
  return "unknown";
}

/**
 * Validates every mapped candidate against `rawOfferSchema`, the contract
 * every scraper's output must satisfy. Invalid items are discarded, not
 * fatal (see #3) — each discard is logged with its `sourceOfferId` so a
 * broken source is diagnosable from the collector's output alone.
 */
export function validateRawOffers(
  sourceId: string,
  candidates: unknown[],
): ValidationResult {
  const offers: RawOffer[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const result = rawOfferSchema.safeParse(candidate);
    if (result.success) {
      offers.push(result.data);
    } else {
      skipped++;
      console.warn(
        `[${sourceId}]`,
        `discarded offer ${candidateSourceOfferId(candidate)}:`,
        result.error.message,
      );
    }
  }

  return { offers, skipped };
}
