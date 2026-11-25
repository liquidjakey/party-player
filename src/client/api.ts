// Client-side fetch helper: returns data or throws ApiError with the server's plain message.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      // Party Wi-Fi can stall without failing: give up after 12 s so buttons never stay stuck.
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    const slow = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new ApiError('NETWORK', slow ? 'Taking too long. Check the Wi-Fi and try again' : 'No connection. Check the Wi-Fi and try again');
  }
  const json = (await res.json().catch(() => null)) as
    | { data: T }
    | { error: { code: string; message: string; details?: Record<string, unknown> } }
    | null;
  if (!res.ok || !json || 'error' in json) {
    const e = json && 'error' in json ? json.error : { code: 'INTERNAL', message: 'Something broke. Try again.' };
    throw new ApiError(e.code, e.message, e.details);
  }
  return json.data;
}
