// A guest's initial in one of the autumn colors. Same name → same color everywhere.
const TINTS = [
  'bg-accent text-white',
  'bg-cranberry text-white',
  'bg-gold text-[#3a2508]',
  'bg-sage text-white',
  'bg-cocoa text-white',
];

/**
 * Signature: one color per guest, used only for that person.
 * Colors follow the party's guest list (A→Z), so the first five guests never share a color.
 * Pages call setGuestOrder() with the guest list; a hash is the fallback for unknown names.
 */
let order = new Map<string, number>();
export function setGuestOrder(names: string[]): void {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (sorted.length === order.size && sorted.every((n, i) => order.get(n) === i)) return;
  order = new Map(sorted.map((n, i) => [n, i]));
}
function indexFor(name: string): number {
  const i = order.get(name);
  if (i !== undefined) return i % TINTS.length;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % TINTS.length;
}

export function tintFor(name: string): string {
  return TINTS[indexFor(name)];
}

/** The same five colors, tuned to read on the dark TV page. */
const TV_HEX = ['#f27a3f', '#e0566c', '#f0b54a', '#8fb077', '#c39070'];
export function tvColorFor(name: string): string {
  return TV_HEX[indexFor(name)];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center rounded-full font-semibold ${tintFor(name)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
