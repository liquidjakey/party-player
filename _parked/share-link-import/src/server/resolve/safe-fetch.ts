// Single network gate for the share-link reader. Blocks SSRF-style targets.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface SafeResponse {
  finalUrl: string;
  status: number;
  body: string;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Resolve the hostname and refuse private addresses. Default: on when using the real fetch. */
  checkDns?: boolean;
}

/** Returns a URL object only if the URL is https and points at a public-looking hostname. */
export function checkUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.')) return null;
  if (host.includes(':') || host.startsWith('[')) return null; // IPv6 literal
  if (/^[\d.]+$/.test(host)) return null; // IPv4 literal (URL normalizes odd forms to dotted)
  if (host === 'localhost' || host.endsWith('.localhost')) return null;
  if (host.endsWith('.local') || host.endsWith('.internal')) return null;
  return url;
}

/** True for loopback, private, link-local, CGNAT, and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '');
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
}

/** DNS check against rebinding: every address the name resolves to must be public. */
async function hostIsPublic(host: string): Promise<boolean> {
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = MAX_BYTES - total;
    const part = value.byteLength > room ? value.subarray(0, room) : value;
    chunks.push(part);
    total += part.byteLength;
  }
  reader.cancel().catch(() => {});
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

async function fetchOnce(
  url: URL,
  fetchFn: typeof fetch,
  opts: SafeFetchOptions,
): Promise<{ res: Response; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetchFn(url.toString(), {
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en', ...opts.headers },
    });
    const isRedirect = res.status >= 300 && res.status < 400;
    const body = isRedirect ? '' : await readCapped(res);
    return { res, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches a URL with SSRF checks, manual redirects, a timeout, and a body cap. Never throws. */
export async function safeFetch(
  raw: string,
  fetchFn: typeof fetch = fetch,
  opts: SafeFetchOptions = {},
): Promise<SafeResponse | null> {
  try {
    // Real network only: tests inject a fake fetch and skip DNS.
    const checkDns = opts.checkDns ?? fetchFn === globalThis.fetch;
    let url = checkUrl(raw);
    for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
      if (checkDns && !(await hostIsPublic(url.hostname))) return null;
      const got = await fetchOnce(url, fetchFn, opts);
      if (!got) return null;
      const { res, body } = got;
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        url = checkUrl(new URL(location, url).toString());
        continue;
      }
      if (!res.ok) return null;
      return { finalUrl: url.toString(), status: res.status, body };
    }
    return null;
  } catch {
    return null;
  }
}

/** Fetches and parses JSON through safeFetch. Returns null on any failure. */
export async function safeFetchJson<T>(raw: string, fetchFn: typeof fetch): Promise<T | null> {
  const res = await safeFetch(raw, fetchFn, { headers: { Accept: 'application/json' } });
  if (!res) return null;
  try {
    return JSON.parse(res.body) as T;
  } catch {
    return null;
  }
}
