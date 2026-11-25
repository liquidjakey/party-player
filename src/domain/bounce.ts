// Pictures that wander and spin behind a page, and bounce off its walls and each other. Pure math, no DOM.

export interface Body {
  cx: number; // center
  cy: number;
  w: number;
  h: number;
  vx: number; // px per second
  vy: number;
  cruise: number; // usual speed, px per second
  pace: number; // speed now = cruise × pace; drifts around 1
  turn: number; // how fast the path curves now, radians per second; drifts around 0
  angle: number; // degrees
  spin: number; // degrees per second now
  rest: number; // the spin it calms down to
}

type Rand = () => number;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Roughly a bell curve around 0, between -1.5 and 1.5 */
const noise = (rand: Rand) => rand() + rand() + rand() - 1.5;

const PACE = { min: 0.5, max: 1.7 };
const MAX_TURN = 1; // radians per second
const MAX_SPIN = 90; // degrees per second

/** A direction that is never close to flat or straight up, so a picture does not slide along a wall. */
export function randomVelocity(speed: number, rand: Rand = Math.random): { vx: number; vy: number } {
  const angle = Math.PI / 9 + rand() * (Math.PI / 2 - (2 * Math.PI) / 9); // 20° to 70°
  return {
    vx: Math.cos(angle) * speed * (rand() < 0.5 ? -1 : 1),
    vy: Math.sin(angle) * speed * (rand() < 0.5 ? -1 : 1),
  };
}

/** 6 to 26 degrees per second, either way around. */
export function randomSpin(rand: Rand = Math.random): number {
  return (6 + rand() * 20) * (rand() < 0.5 ? -1 : 1);
}

export function makeBody(o: { cx: number; cy: number; w: number; h: number; speed: number }, rand: Rand = Math.random): Body {
  const cruise = o.speed * (0.65 + rand() * 0.8);
  const rest = randomSpin(rand);
  return { cx: o.cx, cy: o.cy, w: o.w, h: o.h, cruise, pace: 1, turn: 0, angle: rand() * 50 - 25, spin: rest, rest, ...randomVelocity(cruise, rand) };
}

/** Half the width and height it takes up on screen at its angle. A bit smaller than the box: its corners are only loose dots. */
export function reachOf(b: Body): { rx: number; ry: number } {
  const t = (b.angle * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { rx: ((c * b.w + s * b.h) / 2) * 0.9, ry: ((s * b.w + c * b.h) / 2) * 0.9 };
}

/** The drawings are round-ish, so they touch each other as circles. */
export const radiusOf = (b: Body) => ((b.w + b.h) / 4) * 0.86;

/** A hit spins a picture up in a new random direction; it calms down to the new resting spin. */
function bump(b: Body, rand: Rand) {
  b.rest = randomSpin(rand);
  b.spin = clamp(b.rest * (1.8 + rand() * 1.6), -MAX_SPIN, MAX_SPIN);
  b.pace = clamp(0.8 + rand() * 0.8, PACE.min, PACE.max);
  b.turn = 0;
}

function wander(b: Body, dt: number, rand: Rand): Body {
  const jolt = Math.sqrt(dt); // random steps grow with the square root of time, so any frame rate looks the same
  const turn = clamp(b.turn - b.turn * 0.7 * dt + noise(rand) * 1.5 * jolt, -MAX_TURN, MAX_TURN);
  const pace = clamp(b.pace + (1 - b.pace) * 0.45 * dt + noise(rand) * 0.55 * jolt, PACE.min, PACE.max);
  const spin = clamp(b.spin + (b.rest - b.spin) * 0.6 * dt + noise(rand) * 14 * jolt, -MAX_SPIN, MAX_SPIN);
  const dir = Math.atan2(b.vy, b.vx) + turn * dt;
  const speed = b.cruise * pace;
  const vx = Math.cos(dir) * speed;
  const vy = Math.sin(dir) * speed;
  return { ...b, turn, pace, spin, vx, vy, angle: (b.angle + spin * dt) % 360, cx: b.cx + vx * dt, cy: b.cy + vy * dt };
}

/** Keep a picture in the room. Returns the walls it passed: -1 = left/top, 1 = right/bottom, 0 = none. */
function hold(b: Body, width: number, height: number): { x: number; y: number } {
  const { rx, ry } = reachOf(b);
  const fit = (v: number, r: number, size: number) => (size <= 2 * r ? size / 2 : clamp(v, r, size - r));
  const cx = fit(b.cx, rx, width);
  const cy = fit(b.cy, ry, height);
  const side = { x: Math.sign(b.cx - cx), y: Math.sign(b.cy - cy) };
  b.cx = cx;
  b.cy = cy;
  return side;
}

/** Move every picture one step: wander and spin, then the walls, then each pair. */
export function stepBodies(bodies: Body[], dt: number, width: number, height: number, rand: Rand = Math.random): Body[] {
  const out = bodies.map((b) => (dt > 0 ? wander(b, dt, rand) : { ...b }));

  for (const b of out) {
    const side = hold(b, width, height);
    // Turn back only if it moves into the wall (a spin next to a wall can push it in without moving)
    const hitX = side.x * b.vx > 0;
    const hitY = side.y * b.vy > 0;
    if (!hitX && !hitY) continue;
    const next = randomVelocity(Math.hypot(b.vx, b.vy), rand);
    const signX = hitX ? -side.x : Math.sign(b.vx) || 1;
    const signY = hitY ? -side.y : Math.sign(b.vy) || 1;
    b.vx = Math.abs(next.vx) * signX;
    b.vy = Math.abs(next.vy) * signY;
    bump(b, rand);
  }

  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) collide(out[i], out[j], rand);
  }
  for (const b of out) hold(b, width, height); // a push must not move a picture through a wall
  return out;
}

function collide(a: Body, b: Body, rand: Rand) {
  const reach = radiusOf(a) + radiusOf(b);
  let dx = b.cx - a.cx;
  let dy = b.cy - a.cy;
  let gap = Math.hypot(dx, dy);
  if (gap >= reach) return;
  if (gap < 0.01) {
    // exactly on top of each other: pick any direction
    const t = rand() * Math.PI * 2;
    dx = Math.cos(t);
    dy = Math.sin(t);
    gap = 1;
  }
  const nx = dx / gap;
  const ny = dy / gap;
  const push = (reach - Math.min(gap, reach)) / 2;
  a.cx -= nx * push;
  a.cy -= ny * push;
  b.cx += nx * push;
  b.cy += ny * push;
  const turnedA = deflect(a, nx, ny, rand);
  const turnedB = deflect(b, -nx, -ny, rand);
  if (turnedA || turnedB) {
    bump(a, rand);
    bump(b, rand);
  }
}

/** Mirror a picture that moves along (nx, ny), then turn it by up to 25° more, but never back into the other one. */
function deflect(b: Body, nx: number, ny: number, rand: Rand): boolean {
  const into = b.vx * nx + b.vy * ny;
  if (into <= 0) return false;
  b.vx -= 2 * into * nx;
  b.vy -= 2 * into * ny;
  const t = (rand() - 0.5) * 0.87;
  const vx = b.vx * Math.cos(t) - b.vy * Math.sin(t);
  const vy = b.vx * Math.sin(t) + b.vy * Math.cos(t);
  if (vx * nx + vy * ny < 0) {
    b.vx = vx;
    b.vy = vy;
  }
  return true;
}
