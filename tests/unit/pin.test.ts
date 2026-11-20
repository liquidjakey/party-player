import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/adapters/db', () => ({ db: () => { throw new Error('no db in unit tests'); } }));

const { lockDecision, MAX_FAILS, LOCK_MS } = await import('@/server/adapters/pin');

describe('lockDecision (U6)', () => {
  const now = Date.parse('2026-11-26T20:00:00Z');
  it('not locked with few fails', () => expect(lockDecision(2, null, now)).toEqual({ locked: false, failsSoFar: 2 }));
  it('locked while lock time is in the future', () =>
    expect(lockDecision(0, new Date(now + 10_000).toISOString(), now)).toEqual({ locked: true }));
  it('lock expired → counter resets', () =>
    expect(lockDecision(0, new Date(now - 1).toISOString(), now)).toEqual({ locked: false, failsSoFar: 0 }));
  it('constants match the plan', () => {
    expect(MAX_FAILS).toBe(5);
    expect(LOCK_MS).toBe(60_000);
  });
});
