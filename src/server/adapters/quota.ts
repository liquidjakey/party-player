// Design Ref: §6.1 QUOTA_EXCEEDED — count YouTube Data API units per day (quota resets at midnight Pacific).
import 'server-only';
import { db } from './db';

export const QUOTA_DAILY = 10_000;
export const QUOTA_SOFT_LIMIT = 9_500;

export const COST = { videosList: 1, playlistInsert: 50, playlistDelete: 50 } as const;

function pacificDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now); // YYYY-MM-DD
}

export async function quotaUsedToday(): Promise<number> {
  const { data } = await db().from('quota_usage').select('units').eq('day', pacificDay()).maybeSingle();
  return data?.units ?? 0;
}

/** Returns false (and spends nothing) if this call would pass the soft limit. */
export async function spendQuota(units: number): Promise<boolean> {
  if (process.env.YOUTUBE_FAKE === '1') return true;
  if ((await quotaUsedToday()) + units > QUOTA_SOFT_LIMIT) return false;
  await db().rpc('add_quota', { p_day: pacificDay(), p_units: units });
  return true;
}
