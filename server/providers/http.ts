export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET JSON with a timeout and retries. Retries 429 and 5xx with exponential
 * backoff, honouring Retry-After; other 4xx fail at once.
 */
export async function fetchJson<T>(
  url: string,
  { timeoutMs = 15000, retries = 4, baseDelayMs = 2000 }: { timeoutMs?: number; retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json', 'user-agent': 'PLAYFRAME catalog sync (+self-hosted)' },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) throw new HttpError(res.status, `HTTP ${res.status} for ${redact(url)}`);
      if (attempt >= retries) throw new HttpError(res.status, `HTTP ${res.status} after ${attempt + 1} tries for ${redact(url)}`);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt);
    } catch (err) {
      if (err instanceof HttpError && err.status !== 429 && err.status < 500) throw err;
      if (attempt >= retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
    attempt++;
  }
}

/** Never print a key into logs. */
export function redact(url: string): string {
  return url.replace(/([?&]key=)[^&]+/i, '$1REDACTED');
}

export { sleep };
