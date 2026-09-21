import type { EventSource } from "../types";

/**
 * TODO: implement. Inspect eventim.com.br filtered by "Joinville" to find
 * the search/listing endpoint, then map results to RawEvent[].
 */
export const eventimSource: EventSource = {
  id: "eventim",
  name: "Eventim",
  async fetchEvents() {
    throw new Error("eventim scraper not implemented yet");
  },
};
