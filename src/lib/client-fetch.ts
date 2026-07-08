type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 15_000;

export function invalidateShared(url: string) {
  cache.delete(url);
}

export async function fetchSharedJson<T>(
  url: string,
  options?: { ttlMs?: number; signal?: AbortSignal }
): Promise<T> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  let request = inFlight.get(url) as Promise<T> | undefined;

  if (!request) {
    request = (async () => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Request failed.");
      }

      return payload as T;
    })()
      .then((value) => {
        if (ttl > 0) {
          cache.set(url, { value, expiresAt: Date.now() + ttl });
        }
        return value;
      })
      .finally(() => {
        inFlight.delete(url);
      });

    inFlight.set(url, request);
  }

  const signal = options?.signal;
  if (!signal) {
    return request;
  }

  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });

    request!
      .then((value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}
