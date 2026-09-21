import type { EventSource } from "../types";

/**
 * TODO: implement. Shotgun is a JS-heavy SPA; a plain fetch of the HTML
 * likely won't contain event data. Check for a public JSON API first
 * (network tab on shotgun.live filtered by "Joinville"); fall back to
 * a headless browser (e.g. Playwright) only if no API is found.
 */
export const shotgunSource: EventSource = {
  id: "shotgun",
  name: "Shotgun",
  async fetchEvents() {
    throw new Error("shotgun scraper not implemented yet");
  },
};
