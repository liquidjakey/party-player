'use client';
// Shared full-page states: loading, not found, and "can't reach the party" with a retry.

export function StateScreen({
  title,
  text,
  onRetry,
}: {
  title: string;
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="grid flex-1 place-items-center px-4 text-center">
      <div className="arrive">
        <h1 className="t-title">{title}</h1>
        {text && <p className="mt-1 text-muted">{text}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="press btn-primary mt-5 min-h-11 rounded-xl px-6 font-semibold">
            Try again
          </button>
        )}
      </div>
    </main>
  );
}

/** Picks the right screen for a live page that has no data yet, or null when the page can render. */
export function liveGate(status: string, hasEvent: boolean, retry: () => void) {
  if (status === 'not_found') return <StateScreen title="Party not found" text="Check the link with the host" />;
  if (!hasEvent && status === 'error')
    return <StateScreen title="Can't reach the party" text="Check the Wi-Fi. Trying again on its own too" onRetry={retry} />;
  if (!hasEvent) return <StateScreen title="Loading…" />;
  return null;
}
