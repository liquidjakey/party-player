// Design Ref: §8.3 L1 API scenarios. Run: YOUTUBE_FAKE=1 npm run dev  →  npm run seed  →  npm run test:api
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

config({ path: '.env.local' });
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const S = '/api/e/test';

type J = { data?: any; error?: { code: string; message: string; details?: any } }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<{ status: number; json: J; setCookie: string | null }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as J, setCookie: res.headers.get('set-cookie') };
}

const created: string[] = ['test'];

// Leave no test parties behind (they would show up as real data).
afterAll(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  await sb.from('events').delete().in('slug', created);
});

let guests: { id: string; name: string }[] = [];
const guest = (n: string) => guests.find((g) => g.name === n)!.id;
let hostCookie = '';

beforeAll(async () => {
  const r = await call('GET', S);
  if (r.status !== 200) throw new Error('Seed first: npm run seed (and run the app with YOUTUBE_FAKE=1)');
  guests = r.json.data.guests;
});

describe('events', () => {
  it('1 creates an event with a valid admin PIN', async () => {
    const slug = `t-${Date.now()}`;
    created.push(slug);
    const r = await call('POST', '/api/events', { adminPin: process.env.ADMIN_PIN, name: 'L1', slug, guests: ['A', 'B'], hostPin: '9999', region: 'KR' });
    expect(r.status).toBe(201);
    expect(r.json.data.guests).toHaveLength(2);
  });
  it('2 refuses a wrong admin PIN', async () => {
    const r = await call('POST', '/api/events', { adminPin: 'nope', name: 'x', slug: 'x-wrong', guests: [], hostPin: '1234' });
    expect([401, 429]).toContain(r.status);
  });
});

describe('tracks', () => {
  let added = '';
  it('3 adds a valid video', async () => {
    const r = await call('POST', `${S}/tracks`, { guestId: guest('Sofia'), url: `https://youtu.be/okL1${Date.now().toString().slice(-7)}` });
    expect(r.status).toBe(201);
    added = r.json.data.id;
  });
  it('4 rejects a non-YouTube link', async () => {
    const r = await call('POST', `${S}/tracks`, { guestId: guest('Sofia'), url: 'https://example.com' });
    expect(r.json.error?.code).toBe('INVALID_LINK');
  });
  it.each([
    ['private0001', 'VIDEO_PRIVATE'],
    ['noEmbed0001', 'NOT_EMBEDDABLE'],
    ['krBlocked01', 'REGION_BLOCKED'],
    ['zzzzzzzzzzz', 'VIDEO_NOT_FOUND'],
  ])('5 rejects %s with %s', async (id, code) => {
    const r = await call('POST', `${S}/tracks`, { guestId: guest('Sofia'), url: `https://youtu.be/${id}` });
    expect(r.status).toBe(422);
    expect(r.json.error?.code).toBe(code);
  });
  it('6 refuses a duplicate and names who added it', async () => {
    const r = await call('POST', `${S}/tracks`, { guestId: guest('Kenji'), url: 'https://youtu.be/okSong00002' });
    expect(r.status).toBe(409);
    expect(r.json.error?.details?.addedByName).toBe('Kenji');
  });
  it('8 refuses removal by another guest', async () => {
    const r = await call('DELETE', `${S}/tracks/${added}`, { guestId: guest('Maya') });
    expect(r.json.error?.code).toBe('NOT_OWNER');
  });
  it('7 owner removes', async () => {
    const r = await call('DELETE', `${S}/tracks/${added}`, { guestId: guest('Sofia') });
    expect(r.status).toBe(200);
  });
});

describe('host', () => {
  it('12 control without cookie → 401', async () => {
    const r = await call('POST', `${S}/host/control`, { action: 'skip' });
    expect(r.json.error?.code).toBe('UNAUTHORIZED');
  });
  it('logs in with the right PIN', async () => {
    const r = await call('POST', `${S}/host/login`, { pin: '1234' });
    expect(r.status).toBe(200);
    hostCookie = (r.setCookie ?? '').split(';')[0];
    expect(hostCookie).toMatch(/^pp_host_/);
  });
  it('14 live link that is not live → NOT_LIVE', async () => {
    const r = await call('PATCH', `${S}/host/settings`, { liveUrl: 'https://youtu.be/okSong00001' }, hostCookie);
    expect(r.json.error?.code).toBe('NOT_LIVE');
  });
  it('accepts a live filler', async () => {
    const r = await call('PATCH', `${S}/host/settings`, { liveUrl: 'https://youtu.be/liveNow0001' }, hostCookie);
    expect(r.status).toBe(200);
  });
});

describe('player', () => {
  it('10/11 claim, ended → advance, stale player refused', async () => {
    const a = await call('POST', `${S}/player`, { action: 'claim', playerId: 'tv-aaaaaaaa' });
    expect(a.status).toBe(200);
    const before = a.json.data;
    const e = await call('POST', `${S}/player`, { action: 'ended', playerId: 'tv-aaaaaaaa', trackId: before.currentTrackId, playSeq: before.playSeq });
    expect(e.json.data.playSeq).toBe(before.playSeq + 1);
    await call('POST', `${S}/player`, { action: 'claim', playerId: 'tv-bbbbbbbb' });
    const stale = await call('POST', `${S}/player`, { action: 'position', playerId: 'tv-aaaaaaaa', positionSec: 5 });
    expect(stale.json.error?.code).toBe('NOT_ACTIVE_PLAYER');
  });
  it('a guest cannot remove the song that is playing; the host can', async () => {
    const st = (await call('POST', `${S}/player`, { action: 'claim', playerId: 'tv-aaaaaaaa' })).json.data;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: cur } = await sb.from('tracks').select('id, added_by').eq('id', st.currentTrackId).single();
    const g = await call('DELETE', `${S}/tracks/${cur!.id}`, { guestId: cur!.added_by });
    expect(g.json.error?.code).toBe('SONG_PLAYING');
    const same = (await call('POST', `${S}/player`, { action: 'claim', playerId: 'tv-aaaaaaaa' })).json.data;
    expect(same.currentTrackId).toBe(cur!.id);
  });
  it('TV buttons: next, previous, next again, pause, play; another screen is refused', async () => {
    const tv = (command: string, playerId = 'tv-aaaaaaaa') => call('POST', `${S}/player`, { action: 'control', playerId, command });
    const one = (await call('POST', `${S}/player`, { action: 'claim', playerId: 'tv-aaaaaaaa' })).json.data.currentTrackId;
    const two = (await tv('skip')).json.data.currentTrackId;
    expect(two).not.toBe(one);
    expect((await tv('back')).json.data.currentTrackId).toBe(one);
    expect((await tv('skip')).json.data.currentTrackId).toBe(two);
    expect((await tv('pause')).json.data.isPlaying).toBe(false);
    expect((await tv('play')).json.data.isPlaying).toBe(true);
    expect((await tv('skip', 'tv-zzzzzzzz')).json.error?.code).toBe('NOT_ACTIVE_PLAYER');
  });
  it('13 five wrong PINs → locked', async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call('POST', `${S}/host/login`, { pin: '0000' })).status;
    expect(last).toBe(429);
  });
});
