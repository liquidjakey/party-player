import { describe, expect, it } from 'vitest';
import { makeBody, radiusOf, randomSpin, randomVelocity, reachOf, stepBodies, type Body } from '@/domain/bounce';

const body = (o: Partial<Body> = {}): Body => ({
  cx: 100, cy: 100, w: 20, h: 20, vx: 30, vy: 40, cruise: 50, pace: 1, turn: 0, angle: 0, spin: 0, rest: 10, ...o,
});
const speed = (b: Body) => Math.hypot(b.vx, b.vy);
const gap = (a: Body, b: Body) => Math.hypot(a.cx - b.cx, a.cy - b.cy) - radiusOf(a) - radiusOf(b);
const seeded = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const inside = (b: Body, w: number, h: number) => {
  const { rx, ry } = reachOf(b);
  return b.cx >= rx - 0.01 && b.cx <= w - rx + 0.01 && b.cy >= ry - 0.01 && b.cy <= h - ry + 0.01;
};

describe('walls', () => {
  it.each([
    ['left', { cx: 9.2, vx: -40, vy: 30 }, (b: Body) => b.vx > 0 && b.vy > 0],
    ['right', { cx: 490.8, vx: 40, vy: 30 }, (b: Body) => b.vx < 0 && b.vy > 0],
    ['top', { cy: 9.2, vx: 30, vy: -40 }, (b: Body) => b.vy > 0 && b.vx > 0],
    ['bottom', { cy: 490.8, vx: 30, vy: 40 }, (b: Body) => b.vy < 0 && b.vx > 0],
    ['corner', { cx: 490.8, cy: 490.8, vx: 40, vy: 30 }, (b: Body) => b.vx < 0 && b.vy < 0],
  ])('bounces off the %s and spins up', (_n, start, ok) => {
    const [b] = stepBodies([body(start)], 0.1, 500, 500, seeded());
    expect(ok(b)).toBe(true);
    expect(Math.abs(b.spin)).toBeGreaterThan(Math.abs(b.rest));
  });
  it('a room smaller than the picture does not break', () => {
    const [b] = stepBodies([body({ w: 900, h: 900 })], 0.1, 500, 400);
    expect([b.cx, b.cy]).toEqual([250, 200]);
  });
  it('the window shrinks: pulled back inside, no time passes', () => {
    const [b] = stepBodies([body({ cx: 480, cy: 480 })], 0, 200, 200);
    expect(inside(b, 200, 200)).toBe(true);
  });
  it('a turned picture needs more room than a straight one', () => {
    expect(reachOf(body({ angle: 45 })).rx).toBeGreaterThan(reachOf(body()).rx);
  });
});

describe('pictures bounce off each other', () => {
  it('head on: both turn back, apart, and spin up', () => {
    const [a, b] = stepBodies([body({ vx: 40, vy: 0 }), body({ cx: 115, vx: -40, vy: 0 })], 0, 500, 500, seeded());
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(speed(a)).toBeCloseTo(40);
    expect(gap(a, b)).toBeGreaterThanOrEqual(-0.001);
    expect(a.spin).not.toBe(0);
  });
  it('one that already moves away keeps its way', () => {
    const [a, b] = stepBodies([body({ vx: 60, vy: 0 }), body({ cx: 115, vx: 10, vy: 0 })], 0, 500, 500, seeded());
    expect(a.vx).toBeLessThan(0);
    expect([b.vx, b.vy]).toEqual([10, 0]);
  });
  it('far apart: nothing changes', () => {
    const [a] = stepBodies([body(), body({ cx: 400, cy: 400 })], 0, 500, 500);
    expect([a.vx, a.vy, a.spin]).toEqual([30, 40, 0]);
  });
  it('exactly on top of each other: they separate', () => {
    const [a, b] = stepBodies([body(), body()], 0, 500, 500);
    expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThan(1);
  });
});

describe('random movement', () => {
  it('starts are all different', () => {
    const list = Array.from({ length: 20 }, () => makeBody({ cx: 0, cy: 0, w: 10, h: 10, speed: 30 }));
    expect(new Set(list.map((b) => b.cruise)).size).toBe(20);
    expect(new Set(list.map((b) => b.spin)).size).toBe(20);
  });
  it('never starts almost flat, straight up, or without spin', () => {
    for (let i = 0; i < 200; i++) {
      const v = randomVelocity(100);
      expect(Math.min(Math.abs(v.vx), Math.abs(v.vy))).toBeGreaterThan(30);
      expect(Math.abs(randomSpin())).toBeGreaterThanOrEqual(6);
    }
  });
  it('path, pace and spin change on their own, with no hits', () => {
    const rand = seeded(3);
    let [b] = [makeBody({ cx: 50_000, cy: 50_000, w: 20, h: 20, speed: 30 }, rand)];
    const dirs: number[] = [], speeds: number[] = [], spins: number[] = [];
    for (let i = 0; i < 60 * 30; i++) {
      [b] = stepBodies([b], 1 / 60, 100_000, 100_000, rand);
      dirs.push(Math.atan2(b.vy, b.vx)); speeds.push(speed(b) / b.cruise); spins.push(b.spin);
    }
    const spread = (x: number[]) => Math.max(...x) - Math.min(...x);
    expect(spread(dirs)).toBeGreaterThan(0.5);
    expect(spread(speeds)).toBeGreaterThan(0.2);
    expect(spread(spins)).toBeGreaterThan(5);
    // smooth: no sudden turn between two frames
    expect(Math.max(...dirs.slice(1).map((d, i) => { const x = Math.abs(d - dirs[i]); return Math.min(x, 2 * Math.PI - x); }))).toBeLessThan(0.05);
  });
  it('8 on a small phone for 30 minutes: inside, calm, rarely overlapping, none stuck', () => {
    const rand = seeded();
    let bs = Array.from({ length: 8 }, (_, i) => makeBody({ cx: (i % 2) * 150 + 80, cy: Math.floor(i / 2) * 140 + 70, w: 64, h: 60, speed: 30 }, rand));
    let deep = 0;
    const steps = 30 * 60 * 30;
    let mark = bs;
    for (let n = 1; n <= steps; n++) {
      bs = stepBodies(bs, 1 / 30, 320, 568, rand);
      for (let i = 0; i < 8; i++) {
        if (!inside(bs[i], 320, 568)) throw new Error('outside');
        if (speed(bs[i]) > bs[i].cruise * 1.71 || Math.abs(bs[i].spin) > 90) throw new Error('too fast');
        for (let j = i + 1; j < 8; j++) if (gap(bs[i], bs[j]) < -4) deep++;
      }
      if (n % 900 === 0) {
        bs.forEach((b, i) => { if (Math.hypot(b.cx - mark[i].cx, b.cy - mark[i].cy) < 0.5) throw new Error('stuck'); });
        mark = bs;
      }
    }
    expect(deep / steps).toBeLessThan(0.02);
  });
});
