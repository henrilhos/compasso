import type { EventSource } from "../types";

/**
 * TODO: implement. Inspect the site's listing page for Joinville/Blumenau
 * region events to find the endpoint or HTML structure, then map results
 * to RawEvent[] (cheerio is available for HTML parsing).
 */
export const blumieSource: EventSource = {
  id: "blumie",
  name: "Blumie",
  async fetchEvents() {
    throw new Error("blumie scraper not implemented yet");
  },
};
