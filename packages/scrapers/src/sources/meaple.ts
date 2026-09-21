import type { EventSource } from "../types";

/**
 * TODO: implement. Inspect the site's listing page for Joinville events to
 * find the endpoint or HTML structure, then map results to RawEvent[]
 * (cheerio is available for HTML parsing).
 */
export const meapleSource: EventSource = {
  id: "meaple",
  name: "Meaple",
  async fetchEvents() {
    throw new Error("meaple scraper not implemented yet");
  },
};
