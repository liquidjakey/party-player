// A guest's initial in their own autumn color. Same guest → same color everywhere (badge, queue dot, TV).
// Colors are saved per guest when they're added (guests.color); old rows fall back to A→Z order.

export const TINT_COUNT = 5;

let saved = new Map<string, number>();
export function setGuestOrder(guests: { name: string; color?: number | null }[]): void {
  const sorted = [...guests].sort((a, b) => a.name.localeCompare(b.name));
  saved = new Map(sorted.map((g, i) => [g.name, g.color ?? i % TINT_COUNT]));
}

function indexFor(name: string): number {
  const i = saved.get(name);
  if (i !== undefined) return i % TINT_COUNT;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % TINT_COUNT;
}

/** CSS class with a background and a readable text color (see .tint-N in globals.css). */
export function tintFor(name: string): string {
  return `tint-${indexFor(name)}`;
}

/** The same five colors, tuned to read on the dark TV page. */
const TV_HEX = ['#f27a3f', '#e0566c', '#f0b54a', '#8fb077', '#c39070'];
export function tvColorFor(name: string): string {
  return TV_HEX[indexFor(name)];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const em = size / 16;
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center rounded-full font-semibold ${tintFor(name)}`}
      style={{ width: `${em}rem`, height: `${em}rem`, fontSize: `${em * 0.42}rem` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
