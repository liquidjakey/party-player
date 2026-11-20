'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * iOS-style navigation: a large title that scrolls away, and a translucent bar that
 * fades in its small title + a soft scroll-edge only once content runs under it.
 */
export function NavBar({
  title,
  kicker,
  trailing,
}: {
  title: string;
  kicker?: string;
  trailing?: React.ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { rootMargin: '-44px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={`sticky top-0 z-40 -mx-4 px-4 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 ${
          scrolled ? 'material shadow-[inset_0_-0.5px_0_var(--line)]' : ''
        }`}
      >
        <div className="flex h-11 items-center justify-between gap-3">
          <span className={`t-headline truncate transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!scrolled}>
            {title}
          </span>
          <div className="flex flex-none items-center gap-3">{trailing}</div>
        </div>
      </div>
      <div ref={sentinel} className="pb-1">
        {kicker && <p className="t-footnote font-medium text-muted">{kicker}</p>}
        <h1 className="t-large truncate">{title}</h1>
      </div>
    </>
  );
}
