import type { OfferSource } from "../types";

/**
 * NÃO IMPLEMENTAR. Descartado por robots.txt, Akamai e
 * inventário de 1 evento. Ver `docs/adr/0003-eventim-descartado.md`.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/12
 */
export const eventimSource: OfferSource = {
  id: "eventim",
  name: "Eventim",
  async fetchOffers() {
    throw new Error("eventim scraper not implemented yet");
  },
};
