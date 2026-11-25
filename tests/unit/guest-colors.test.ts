import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/adapters/db', () => ({ db: () => { throw new Error('no db in unit tests'); }, must: (r: { data: unknown }) => r.data, toEvent: (x: unknown) => x, toGuest: (x: unknown) => x }));

const { pickColors } = await import('@/server/services/event-service');

describe('pickColors (stable, distinct guest colors)', () => {
  it('first five guests get five different colors', () => expect(pickColors([], 5)).toEqual([0, 1, 2, 3, 4]));
  it('a new guest takes the least-used color', () => expect(pickColors([0, 1, 2, 4], 1)).toEqual([3]));
  it('after all five are used, it starts over evenly', () => expect(pickColors([0, 1, 2, 3, 4, 0], 2)).toEqual([1, 2]));
  it('ignores old guests without a saved color', () => expect(pickColors([null, null], 1)).toEqual([0]));
});
