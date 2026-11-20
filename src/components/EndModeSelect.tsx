'use client';
import { useState } from 'react';
import type { EndMode, PartyEvent } from '@/domain/types';
import { api, ApiError } from '@/client/api';

const MODES: { value: EndMode; label: string; hint: string }[] = [
  { value: 'loop', label: 'Loop', hint: 'Starts again from the first song' },
  { value: 'stop', label: 'Stop', hint: 'The music ends. A new song starts it again.' },
  { value: 'live', label: 'Live Stream', hint: 'Plays a live stream until someone adds a song' },
];

/** FR-08 — iOS segmented control for what happens when every song has played. */
export function EndModeSelect({ event, onSaved }: { event: PartyEvent; onSaved: (msg: string) => void }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idx = MODES.findIndex((m) => m.value === event.endMode);

  async function save(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ liveTitle: string | null }>(`/api/e/${event.slug}/host/settings`, { method: 'PATCH', body });
      onSaved(res.liveTitle ? `Live stream: ${res.liveTitle}` : okMsg);
      setLink('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something broke.');
    } finally {
      setBusy(false);
    }
  }

  const liveLabel = event.liveSource
    ? event.liveSource.replace('https://www.', '').replace(/\/live$/, '')
    : event.liveVideoId
      ? `youtu.be/${event.liveVideoId}`
      : null;

  return (
    <section>
      <h2 className="t-section">After the last song</h2>
      <div className="card space-y-3 p-3">
        <div role="radiogroup" aria-label="After the last song" className="relative grid grid-cols-3 rounded-[10px] bg-fill p-0.5">
          <span
            aria-hidden
            className="absolute inset-y-0.5 left-0.5 rounded-lg bg-surface shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[var(--ease-out)]"
            style={{ width: 'calc((100% - 4px) / 3)', transform: `translateX(${idx * 100}%)` }}
          />
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={event.endMode === m.value}
              disabled={busy}
              onClick={() => event.endMode !== m.value && save({ endMode: m.value }, `After the last song: ${m.label}`)}
              className={`relative z-10 min-h-8 rounded-lg text-[0.8125rem] font-semibold transition-opacity ${
                event.endMode === m.value ? '' : 'opacity-70'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="t-footnote px-1 text-muted">{MODES[idx]?.hint}</p>
      </div>

      <h2 className="t-section mt-5">Live stream</h2>
      <div className="group">
        {liveLabel && (
          <div className="group-row">
            <span className="min-w-0 flex-1 truncate">{liveLabel}</span>
            <button type="button" disabled={busy} onClick={() => save({ clearLive: true }, 'Live stream removed')} className="press text-danger">
              Remove
            </button>
          </div>
        )}
        <form
          className="group-row py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) save({ liveUrl: link.trim() }, 'Live stream saved');
          }}
        >
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={liveLabel ? 'Change stream link' : 'youtube.com/@LofiGirl'}
            inputMode="url"
            autoCapitalize="off"
            className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
          />
          <button type="submit" disabled={busy || !link.trim()} className="press font-semibold text-accent disabled:opacity-30">
            Save
          </button>
        </form>
      </div>
      <p className={`t-footnote mt-1.5 px-4 ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
        {error ?? 'A channel link keeps working when its stream restarts'}
      </p>
    </section>
  );
}
