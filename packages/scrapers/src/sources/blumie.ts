import type { OfferSource } from "../types";

/**
 * API pública em `api.blumie.com.br`. `days` é um array —
 * evento de vários dias vira uma Oferta só (ADR-0001).
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/8
 */
export const blumieSource: OfferSource = {
  id: "blumie",
  name: "Blumie",
  async fetchOffers() {
    throw new Error("blumie scraper not implemented yet");
  },
};
