import type { EventSource } from "../types";

/**
 * TODO: implement. Eventbrite has a public Destination API used by its own
 * search pages; inspect eventbrite.com.br filtered by "Joinville" to find
 * the endpoint and shape, then map results to RawEvent[].
 */
export const eventbriteSource: EventSource = {
  id: "eventbrite",
  name: "Eventbrite",
  async fetchEvents() {
    throw new Error("eventbrite scraper not implemented yet");
  },
};
