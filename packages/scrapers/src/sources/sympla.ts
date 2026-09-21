import type { OfferSource } from "../types";

/**
 * Sem API JSON: parsear o payload RSC (`self.__next_f`) da
 * listagem. A fonte de maior volume — ver a issue antes de começar.
 *
 * Especificação completa — endpoint, mapeamento campo a campo e armadilhas
 * medidas: https://github.com/henrilhos/compasso/issues/6
 */
export const symplaSource: OfferSource = {
  id: "sympla",
  name: "Sympla",
  async fetchOffers() {
    throw new Error("sympla scraper not implemented yet");
  },
};
