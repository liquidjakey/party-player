// Design Ref: §4.1 /api/google/* + FR-14 — host's Google login for the backup playlist (scope youtube.force-ssl).
import 'server-only';
import { db, must } from './db';
import { decrypt, encrypt } from './crypto';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';

export type GoogleStatus = 'none' | 'ok' | 'expired';

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

/** Callback: trade the code for a refresh token and store it encrypted. */
export async function saveFromCode(code: string): Promise<void> {
  const { ok, json } = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!ok || !json.refresh_token) throw new Error(`Google token exchange failed: ${json.error ?? 'no refresh_token'}`);
  must(
    await db()
      .from('google_auth')
      .upsert({ id: 1, refresh_token_enc: encrypt(json.refresh_token), status: 'ok', updated_at: new Date().toISOString() }),
  );
  cached = json.access_token ? { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 } : null;
}

export async function googleStatus(): Promise<GoogleStatus> {
  const { data } = await db().from('google_auth').select('status').eq('id', 1).maybeSingle();
  return data ? (data.status as GoogleStatus) : 'none';
}

let cached: { token: string; exp: number } | null = null;

/** A fresh access token. Throws GoogleExpiredError when the host must log in again (7-day Testing-mode expiry). */
export async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const { data } = await db().from('google_auth').select('refresh_token_enc, status').eq('id', 1).maybeSingle();
  if (!data || data.status !== 'ok') throw new GoogleExpiredError('not connected');
  const { ok, json } = await tokenCall({ refresh_token: decrypt(data.refresh_token_enc), grant_type: 'refresh_token' });
  if (!ok || !json.access_token) {
    if (json.error === 'invalid_grant') {
      await db().from('google_auth').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', 1);
      throw new GoogleExpiredError('expired');
    }
    throw new Error(`Google refresh failed: ${json.error ?? 'unknown'}`);
  }
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 };
  return cached.token;
}
