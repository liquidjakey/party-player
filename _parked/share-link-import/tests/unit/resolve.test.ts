import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveShareLink } from '@/server/resolve';
import { safeFetch } from '@/server/resolve/safe-fetch';

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/resolve', name), 'utf8');

type Route = { status?: number; body?: string; location?: string };

/** Fake fetch: maps exact URLs to canned responses. Anything else is a 404. Records calls. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response('not found', { status: 404 });
    const headers: Record<string, string> = r.location ? { location: r.location } : {};
    return new Response(r.body ?? '', { status: r.status ?? 200, headers });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const neverFetch = fakeFetch({});

describe('resolveShareLink: YouTube', () => {
  it('reads a watch link without network', async () => {
    const r = await resolveShareLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ', neverFetch.fn);
    expect(r).toEqual({ kind: 'youtube', videoId: 'dQw4w9WgXcQ' });
  });
  it('reads a music.youtube.com link', async () => {
    const r = await resolveShareLink('https://music.youtube.com/watch?v=4NRXx6U8ABQ&si=abc', neverFetch.fn);
    expect(r).toEqual({ kind: 'youtube', videoId: '4NRXx6U8ABQ' });
    expect(neverFetch.calls).toHaveLength(0);
  });
});

describe('resolveShareLink: Spotify', () => {
  const track = 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b';

  it('reads og:title and artist from og:description', async () => {
    const { fn } = fakeFetch({ [track]: { body: fixture('spotify-track.html') } });
    const r = await resolveShareLink('https://open.spotify.com/intl-ko/track/0VjIjW4GlUZAMYd2vXMi3b?si=x', fn);
    expect(r).toEqual({ kind: 'song', service: 'spotify', title: 'Blinding Lights', artist: 'The Weeknd' });
    const init = (vi.mocked(fn).mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('facebookexternalhit/1.1');
  });

  it('follows a spotify.link short link redirect', async () => {
    const { fn, calls } = fakeFetch({
      'https://spotify.link/AbCdEf': { status: 307, location: `${track}?si=1` },
      [`${track}?si=1`]: { body: '<html></html>' },
      [track]: { body: fixture('spotify-track.html') },
    });
    const r = await resolveShareLink('https://spotify.link/AbCdEf', fn);
    expect(r).toEqual({ kind: 'song', service: 'spotify', title: 'Blinding Lights', artist: 'The Weeknd' });
    expect(calls[0]).toBe('https://spotify.link/AbCdEf');
  });

  it('falls back to oEmbed when og tags are missing', async () => {
    const { fn } = fakeFetch({
      [track]: { body: fixture('spotify-no-og.html') },
      [`https://open.spotify.com/oembed?url=${encodeURIComponent(track)}`]: { body: fixture('spotify-oembed.json') },
    });
    const r = await resolveShareLink(track, fn);
    expect(r).toEqual({ kind: 'song', service: 'spotify', title: 'Levitating', artist: null });
  });
});

describe('resolveShareLink: Apple, Deezer, SoundCloud', () => {
  it('reads an Apple ?i= link through iTunes lookup', async () => {
    const { fn } = fakeFetch({
      'https://itunes.apple.com/lookup?id=1503952744&country=us': { body: fixture('itunes-lookup.json') },
    });
    const r = await resolveShareLink(
      'https://music.apple.com/us/album/future-nostalgia/1503952600?i=1503952744',
      fn,
    );
    expect(r).toEqual({ kind: 'song', service: 'apple', title: "Don't Start Now", artist: 'Dua Lipa' });
  });

  it('retries the iTunes lookup without country', async () => {
    const { fn } = fakeFetch({
      'https://itunes.apple.com/lookup?id=1503952744&country=kr': { body: '{"resultCount":0,"results":[]}' },
      'https://itunes.apple.com/lookup?id=1503952744': { body: fixture('itunes-lookup.json') },
    });
    const r = await resolveShareLink('https://music.apple.com/kr/song/dont-start-now/1503952744', fn);
    expect(r).toMatchObject({ kind: 'song', title: "Don't Start Now" });
  });

  it('reads a Deezer link through the public API', async () => {
    const { fn } = fakeFetch({ 'https://api.deezer.com/track/3135556': { body: fixture('deezer-track.json') } });
    const r = await resolveShareLink('https://www.deezer.com/en/track/3135556', fn);
    expect(r).toEqual({
      kind: 'song',
      service: 'deezer',
      title: 'Harder, Better, Faster, Stronger',
      artist: 'Daft Punk',
    });
  });

  it('follows a link.deezer.com short link', async () => {
    const { fn } = fakeFetch({
      'https://link.deezer.com/s/abc': { status: 302, location: 'https://www.deezer.com/track/3135556?utm=x' },
      'https://www.deezer.com/track/3135556?utm=x': { body: '<html></html>' },
      'https://api.deezer.com/track/3135556': { body: fixture('deezer-track.json') },
    });
    const r = await resolveShareLink('https://link.deezer.com/s/abc', fn);
    expect(r).toMatchObject({ kind: 'song', service: 'deezer', artist: 'Daft Punk' });
  });

  it('splits SoundCloud "Song by Artist" from the right', async () => {
    const page = 'https://soundcloud.com/m83/midnight-city';
    const { fn } = fakeFetch({
      [`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(page)}`]: {
        body: fixture('soundcloud-oembed.json'),
      },
    });
    const r = await resolveShareLink(page, fn);
    expect(r).toEqual({ kind: 'song', service: 'soundcloud', title: 'Midnight City', artist: 'M83' });
  });
});

describe('resolveShareLink: generic pages', () => {
  it('cleans a TIDAL og:title and splits it', async () => {
    const url = 'https://tidal.com/browse/track/110653454';
    const { fn } = fakeFetch({ [url]: { body: fixture('tidal-track.html') } });
    expect(await resolveShareLink(url, fn)).toEqual({
      kind: 'song',
      service: 'tidal',
      title: 'Bad Guy',
      artist: 'Billie Eilish',
    });
  });

  it('falls back to <title> and splits "Song - Artist" for Amazon', async () => {
    const url = 'https://music.amazon.com/tracks/B0012345';
    const { fn } = fakeFetch({ [url]: { body: fixture('amazon-title-only.html') } });
    expect(await resolveShareLink(url, fn)).toEqual({
      kind: 'song',
      service: 'amazon',
      title: 'Viva La Vida',
      artist: 'Coldplay',
    });
  });

  it('cleans a " - song by X | Spotify" style title on another host', async () => {
    const url = 'https://example.com/share/1';
    const body = '<meta property="og:title" content="Yellow - song and lyrics by Coldplay | Spotify">';
    const { fn } = fakeFetch({ [url]: { body } });
    expect(await resolveShareLink(url, fn)).toEqual({
      kind: 'song',
      service: 'other',
      title: 'Yellow',
      artist: 'Coldplay',
    });
  });
});

describe('resolveShareLink: share text', () => {
  it('finds the URL inside iOS share text', async () => {
    const track = 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b';
    const { fn } = fakeFetch({ [track]: { body: fixture('spotify-track.html') } });
    const r = await resolveShareLink(`Listen to Blinding Lights on Spotify ${track}?si=abc. Enjoy!`, fn);
    expect(r).toMatchObject({ kind: 'song', title: 'Blinding Lights' });
  });

  it('returns unknown for text with no URL', async () => {
    expect(await resolveShareLink('just some words', neverFetch.fn)).toEqual({ kind: 'unknown' });
  });
});

describe('safety (SSRF)', () => {
  const blocked = [
    'http://example.com/song',
    'https://127.0.0.1/x',
    'https://[::1]/',
    'https://localhost/x',
    'https://printer.local/x',
    'https://db.internal/x',
    'https://intranet/x',
    'https://2130706433/x',
    'file:///etc/passwd',
    'data:text/html,<meta property="og:title" content="x">',
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, async () => {
      const { fn, calls } = fakeFetch({});
      expect(await resolveShareLink(url, fn)).toEqual({ kind: 'unknown' });
      expect(calls).toHaveLength(0);
    });
  }

  it('blocks a redirect to a private host', async () => {
    const { fn, calls } = fakeFetch({
      'https://example.com/go': { status: 302, location: 'https://169.254.169.254/latest/meta-data' },
    });
    expect(await resolveShareLink('https://example.com/go', fn)).toEqual({ kind: 'unknown' });
    expect(calls).toEqual(['https://example.com/go']);
  });

  it('stops after 3 redirects', async () => {
    const routes: Record<string, Route> = {};
    for (let i = 0; i < 6; i++) routes[`https://example.com/${i}`] = { status: 302, location: `/${i + 1}` };
    routes['https://example.com/6'] = { body: '<title>Song - Artist</title>' };
    const { fn, calls } = fakeFetch(routes);
    expect(await resolveShareLink('https://example.com/0', fn)).toEqual({ kind: 'unknown' });
    expect(calls).toHaveLength(4);
  });

  it('sends redirect: manual and a browser User-Agent', async () => {
    const spy = vi.fn(async () => new Response('<title>A - B</title>'));
    await safeFetch('https://example.com/', spy as unknown as typeof fetch);
    const init = (spy.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe('manual');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Mozilla/);
  });

  it('caps the body at 1 MB', async () => {
    const big = 'a'.repeat(3 * 1024 * 1024);
    const res = await safeFetch('https://example.com/', (async () => new Response(big)) as unknown as typeof fetch);
    expect(res?.body.length).toBe(1024 * 1024);
  });
});

describe('failures never throw', () => {
  it('returns unknown when fetch rejects', async () => {
    const boom = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await resolveShareLink('https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b', boom)).toEqual({
      kind: 'unknown',
    });
    expect(await resolveShareLink('https://example.com/x', boom)).toEqual({ kind: 'unknown' });
  });

  it('returns unknown on bad JSON', async () => {
    const { fn } = fakeFetch({ 'https://api.deezer.com/track/1': { body: 'not json' } });
    expect(await resolveShareLink('https://www.deezer.com/track/1', fn)).toEqual({ kind: 'unknown' });
  });

  it('aborts a request that hangs past the timeout', async () => {
    const hang = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    expect(await safeFetch('https://example.com/', hang, { timeoutMs: 20 })).toBeNull();
  });

  it('times out at 5 s by default (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const hang = ((_: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })) as unknown as typeof fetch;
      const pending = resolveShareLink('https://example.com/slow', hang);
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toEqual({ kind: 'unknown' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('lead additions', () => {
  it('store-name-only page → unknown', async () => {
    const { resolveShareLink } = await import('@/server/resolve');
    const fake = (async () =>
      new Response('<html><head><title>Amazon Music</title></head></html>', { status: 200 })) as unknown as typeof fetch;
    expect(await resolveShareLink('https://music.amazon.com/tracks/B0XYZ', fake)).toEqual({ kind: 'unknown' });
  });
  it('isPrivateAddress', async () => {
    const { isPrivateAddress } = await import('@/server/resolve/safe-fetch');
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '142.250.1.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });
});
