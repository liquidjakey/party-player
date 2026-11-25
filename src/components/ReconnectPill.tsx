'use client';
// A floating "Reconnecting…" pill that never pushes the page content around.
export function ReconnectPill({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className="t-footnote material materialize pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-50 mx-auto w-fit rounded-full px-3.5 py-1.5 shadow-[var(--shadow)] ring-1 ring-[var(--material-edge)]"
    >
      Reconnecting…
    </p>
  );
}
