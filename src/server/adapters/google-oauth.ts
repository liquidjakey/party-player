// Design Ref: §4.1 /api/google/* + FR-14 — host's Google login for the backup playlist (scope youtube.force-ssl).
import 'server-only';
import { db, must } from './db';
import { decrypt, encrypt } from './crypto';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';

export type GoogleStatus = 'none' | 'ok' | 'expired' | 'unavailable';

export class GoogleExpiredError extends Error {}

const redirectUri = () => `${process.env.APP_URL?.replace(/\/$/, '')}/api/google/callback`;

export function authUrl(state: string): string {
  const qs = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH}?${qs}`;
}

async function tokenCall(params: Record<string, string>) {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      ...params,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  return { ok: res.ok, json };
}

/** True when this site has a Google login client set up (otherwise the backup feature is hidden). */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
}

// Each party stores its own host's Google login, so hosts never share an account.
const cache = new Map<string, { token: string; exp: number }>();

/** Callback: trade the code for a refresh token and store it encrypted for this party. */
export async function saveFromCode(eventId: string, code: string): Promise<void> {
  const { ok, json } = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!ok || !json.refresh_token) throw new Error(`Google token exchange failed: ${json.error ?? 'no refresh_token'}`);
  must(
    await db()
      .from('event_google_auth')
      .upsert({ event_id: eventId, refresh_token_enc: encrypt(json.refresh_token), status: 'ok', updated_at: new Date().toISOString() }),
  );
  if (json.access_token) cache.set(eventId, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 });
}

export async function googleStatus(eventId: string): Promise<GoogleStatus> {
  const { data } = await db().from('event_google_auth').select('status').eq('event_id', eventId).maybeSingle();
  return data ? (data.status as GoogleStatus) : 'none';
}

/** A fresh access token for this party. Throws GoogleExpiredError when the host must log in again. */
export async function accessToken(eventId: string): Promise<string> {
  const hit = cache.get(eventId);
  if (hit && hit.exp > Date.now()) return hit.token;
  const { data } = await db().from('event_google_auth').select('refresh_token_enc, status').eq('event_id', eventId).maybeSingle();
  if (!data || data.status !== 'ok') throw new GoogleExpiredError('not connected');
  const { ok, json } = await tokenCall({ refresh_token: decrypt(data.refresh_token_enc), grant_type: 'refresh_token' });
  if (!ok || !json.access_token) {
    if (json.error === 'invalid_grant') {
      await db().from('event_google_auth').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('event_id', eventId);
      throw new GoogleExpiredError('expired');
    }
    throw new Error(`Google refresh failed: ${json.error ?? 'unknown'}`);
  }
  cache.set(eventId, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 });
  return json.access_token;
}
