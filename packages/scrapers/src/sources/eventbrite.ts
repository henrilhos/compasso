import type { OfferSource } from "../types";

/**
 * API JSON real, precedida de um handshake CSRF. Atenção:
 * `address.city` guarda o bairro, não a cidade.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/7
 */
export const eventbriteSource: OfferSource = {
  id: "eventbrite",
  name: "Eventbrite",
  async fetchOffers() {
    throw new Error("eventbrite scraper not implemented yet");
  },
};
