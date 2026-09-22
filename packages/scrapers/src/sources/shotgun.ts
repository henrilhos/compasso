import type { CoveredCity } from "@repo/db";
import type { OfferSource } from "../types";

/**
 * BLOQUEADO por decisão, não por código: exige headless
 * browser (Vercel Checkpoint, fingerprint de TLS). Ver ADR-0002 — não
 * implemente sem reabrir aquela decisão.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/10
 */
export const shotgunSource: OfferSource = {
  id: "shotgun",
  name: "Shotgun",
  async fetchOffers(_city: CoveredCity) {
    throw new Error("shotgun scraper not implemented yet");
  },
};
