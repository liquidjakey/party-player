'use client';
import { useEffect, useRef } from 'react';
import { makeBody, stepBodies, type Body } from '@/domain/bounce';

const PICTURES = [
  { name: 'turkey', ratio: 281.957 / 305.452 },
  { name: 'pumpkins', ratio: 348.475 / 250.374 },
  { name: 'pie', ratio: 284.62 / 246.487 },
  { name: 'corn', ratio: 235 / 252 },
  { name: 'cornucopia', ratio: 274.013 / 255.5 },
  { name: 'acorns', ratio: 275 / 264.894 },
  { name: 'mash', ratio: 292 / 257 },
  { name: 'jam', ratio: 204.236 / 213.263 },
];

type Variant = 'phone' | 'tv';
// Where the pictures were, so they carry on from there between the name page and the song page
const last: Partial<Record<Variant, Body[]>> = {};

/**
 * Thanksgiving drawings that wander and spin behind the page, and bounce off its walls, its corners and each other.
 * Only decoration: behind everything, taps go through, hidden from screen readers.
 * With reduced motion they stay still. The browser stops the loop when the page is hidden.
 */
export function Floaters({ variant }: { variant: Variant }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const imgs = [...el.querySelectorAll('img')];
    let W = el.clientWidth;
    let H = el.clientHeight;
    const size = variant === 'tv' ? W * 0.075 : Math.min(84, W * 0.18);
    const speed = variant === 'tv' ? W * 0.03 : 30; // px per second

    // Start spread out: one picture per cell of a 2×4 (phone) or 4×2 (TV) grid
    const cols = W > H ? 4 : 2;
    const rows = PICTURES.length / cols;
    const cells = PICTURES.map((_, i) => i).sort(() => Math.random() - 0.5);
    let bodies = PICTURES.map((p, i): Body => {
      const w = size * Math.sqrt(p.ratio);
      const h = size / Math.sqrt(p.ratio);
      const was = last[variant]?.[i];
      if (was) return { ...was, w, h };
      const cw = W / cols;
      const ch = H / rows;
      return makeBody({
        w,
        h,
        cx: ((cells[i] % cols) + 0.5) * cw + (Math.random() - 0.5) * Math.max(0, cw - w),
        cy: (Math.floor(cells[i] / cols) + 0.5) * ch + (Math.random() - 0.5) * Math.max(0, ch - h),
        speed,
      });
    });

    const draw = () => {
      last[variant] = bodies; // saved every frame: the next page can start before this one is cleaned up
      imgs.forEach((img, i) => {
        const b = bodies[i];
        img.style.transform = `translate3d(${b.cx - b.w / 2}px, ${b.cy - b.h / 2}px, 0) rotate(${b.angle}deg)`;
      });
    };
    imgs.forEach((img, i) => {
      img.style.width = `${bodies[i].w}px`;
      img.style.height = `${bodies[i].h}px`;
    });
    bodies = stepBodies(bodies, 0, W, H); // inside the walls, whatever the last screen was
    draw();
    el.style.opacity = variant === 'tv' ? '0.7' : '0.42';

    const resize = new ResizeObserver(() => {
      if (!el.clientWidth || !el.clientHeight) return; // the page was just hidden: keep the places
      W = el.clientWidth;
      H = el.clientHeight;
      bodies = stepBodies(bodies, 0, W, H);
      draw();
    });
    resize.observe(el);

    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let prev = 0;
    const tick = (now: number) => {
      if (!el.clientWidth) return; // hidden page: stop, so only the visible page moves the drawings
      const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0;
      prev = now;
      bodies = stepBodies(bodies, dt, W, H);
      draw();
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      prev = 0;
      if (!calm.matches) raf = requestAnimationFrame(tick);
    };
    run();
    calm.addEventListener('change', run);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      calm.removeEventListener('change', run);
    };
  }, [variant]);

  return (
    <div
      ref={box}
      aria-hidden
      className={`floaters pointer-events-none inset-0 overflow-hidden transition-opacity duration-700 select-none ${variant === 'tv' ? 'absolute' : 'fixed -z-10'}`}
      style={{ opacity: 0 }}
    >
      {PICTURES.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.name} src={`/floaters/${p.name}.svg`} alt="" draggable={false} className="absolute top-0 left-0 max-w-none will-change-transform" />
      ))}
    </div>
  );
}
