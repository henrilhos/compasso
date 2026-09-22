import { delay } from "./delay";

export const USER_AGENT = "Compasso/1.0 (+https://github.com/henrilhos/compasso)";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

export interface HttpFetchOptions extends RequestInit {
  /** Aborts the request after this many ms. */
  timeoutMs?: number;
  /** Extra attempts after the first, on network errors or 5xx responses. */
  retries?: number;
  /** Base delay for exponential backoff between retries. */
  retryDelayMs?: number;
}

/**
 * `fetch` wrapped with the collection posture every scraper needs: a
 * stable User-Agent, a hard timeout, and retry with exponential backoff
 * on network errors or 5xx responses. 4xx responses are returned as-is —
 * retrying a client error doesn't help.
 */
export async function httpFetch(
  url: string,
  options: HttpFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    headers,
    ...init
  } = options;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const mergedHeaders = new Headers(headers);
      mergedHeaders.set("User-Agent", USER_AGENT);

      const response = await fetch(url, {
        ...init,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      if (response.status < 500 || attempt >= retries) {
        return response;
      }
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await delay(retryDelayMs * 2 ** attempt);
  }
}
