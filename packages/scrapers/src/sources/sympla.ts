import type { EventSource } from "../types";

/**
 * TODO: implement. Sympla has no public search API for arbitrary cities;
 * inspect the network tab on sympla.com.br while filtering by "Joinville"
 * to find the listing endpoint, then map results to RawEvent[].
 */
export const symplaSource: EventSource = {
  id: "sympla",
  name: "Sympla",
  async fetchEvents() {
    throw new Error("sympla scraper not implemented yet");
  },
};
