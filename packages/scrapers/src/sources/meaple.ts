import type { CoveredCity } from "@repo/db";
import type { OfferSource } from "../types";

/**
 * API pública em `api.meaple.com.br`. `city` é case-sensitive,
 * e esta fonte não tem nome de local em campo nenhum.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/9
 */
export const meapleSource: OfferSource = {
  id: "meaple",
  name: "Meaple",
  async fetchOffers(_city: CoveredCity) {
    throw new Error("meaple scraper not implemented yet");
  },
};
