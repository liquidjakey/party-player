// Design Ref: §5.4 Host — FR-10, FR-11, FR-08, FR-14. PIN-protected remote + settings.
'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import type { Track } from '@/domain/types';
import { api, ApiError } from '@/client/api';
import { useEventLive } from '@/client/use-event-live';
import { EndModeSelect } from '@/components/EndModeSelect';
import { HostControls } from '@/components/HostControls';
import { ChevronRightIcon, LinkIcon, MinusCircleIcon, PlusIcon, TvIcon } from '@/components/Icons';
import { Avatar, setGuestOrder } from '@/components/Avatar';
import { NavBar } from '@/components/NavBar';
import { NowPlaying } from '@/components/NowPlaying';
import { QueueList } from '@/components/QueueList';
import { SyncStatus, type SyncSummary } from '@/components/SyncStatus';
import { Toast, type ToastMsg } from '@/components/Toast';

interface Status {
  host: true;
  notice: string | null;
  sync: SyncSummary;
}

const GOOGLE_MSG: Record<string, string> = {
  ok: 'YouTube connected. Copying songs to your backup playlist…',
  denied: 'YouTube was not connected',
  error: 'YouTube connection failed. Try again.',
};

export function Host({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const search = useSearchParams();
  const live = useEventLive(slug);
  setGuestOrder(live.guests.map((g) => g.name));
  const [status, setStatus] = useState<Status | null | 'loading'>('loading');
  const [toast, setToast] = useState<ToastMsg | null>(() => {
    const g = search.get('google');
    return g && GOOGLE_MSG[g] ? { id: 1, kind: g === 'ok' ? 'ok' : 'error', text: GOOGLE_MSG[g] } : null;
  });
  const clearToast = useCallback(() => setToast(null), []);
  const say = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => setToast({ id: Date.now(), kind, text }), []);

  const fetchStatus = useCallback(
    (): Promise<Status | null | 'loading'> =>
      api<Status>(`/api/e/${slug}/host/status`).catch((e) =>
        e instanceof ApiError && e.code === 'UNAUTHORIZED' ? null : 'loading',
      ),
    [slug],
  );
  const loadStatus = useCallback(() => {
    fetchStatus().then(setStatus);
  }, [fetchStatus]);

  // Poll status; also refresh sync counts whenever songs or the notice change.
  const trackKey = live.tracks.map((t) => `${t.id}:${t.syncStatus}`).join(',');
  useEffect(() => {
    let alive = true;
    const run = () => fetchStatus().then((s) => alive && setStatus(s));
    run();
    const t = setInterval(run, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fetchStatus, trackKey, live.event?.notice]);

  const names = useMemo(() => new Map(live.guests.map((g) => [g.id, g.name])), [live.guests]);
  const nameOf = useCallback((id: string | null) => (id ? (names.get(id) ?? 'someone') : 'host'), [names]);
  const currentId = live.player?.currentTrackId ?? null;
  const current = live.tracks.find((t) => t.id === currentId) ?? null;
  const songs = useMemo(
    () => [...(current ? [current] : []), ...upcomingOrder(live.tracks, currentId)],
    [live.tracks, currentId, current],
  );

  if (live.status === 'not_found') return <p className="t-title p-8 text-center">Party not found</p>;
  if (!live.event || status === 'loading') return <p className="p-8 text-center text-muted">Loading…</p>;
  if (status === null) return <PinForm slug={slug} name={live.event.name} onDone={loadStatus} />;

  const event = live.event;

  async function settings(body: Record<string, unknown>, okMsg: string) {
    try {
      await api(`/api/e/${slug}/host/settings`, { method: 'PATCH', body });
      say(okMsg);
      live.refresh();
    } catch (e) {
      say(e instanceof ApiError ? e.message : 'Something broke.', 'error');
    }
  }

  async function removeSong(t: Track) {
    try {
      await api(`/api/e/${slug}/tracks/${t.id}`, { method: 'DELETE', body: {} });
      say('Removed');
      live.refresh();
    } catch (e) {
      say(e instanceof ApiError ? e.message : 'Something broke.', 'error');
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28">
      <NavBar
        title={event.name}
        kicker="Host"
        trailing={
          <button
            type="button"
            onClick={async () => {
              await api(`/api/e/${slug}/host/logout`, { body: {} }).catch(() => {});
              setStatus(null);
            }}
            className="press text-accent"
          >
            Log Out
          </button>
        }
      />

      <div className="mt-4 space-y-7">
        {status.notice === 'live_ended' && (
          <div className="card materialize flex items-center gap-3 p-3.5">
            <p className="flex-1 text-[0.9375rem]">The live stream ended, so the party switched to Loop</p>
            <button type="button" onClick={() => settings({ clearNotice: true }, 'OK')} className="press font-semibold text-accent">
              OK
            </button>
          </div>
        )}

        <section className="space-y-5">
          <NowPlaying event={event} player={live.player} track={current} addedByName={current ? nameOf(current.addedBy) : null} />
          <HostControls slug={slug} isPlaying={live.player?.isPlaying ?? false} onError={(m) => say(m, 'error')} />
        </section>

        <section>
          <h2 className="t-section">Share</h2>
          <div className="group">
            <Link href={`/e/${slug}/tv`} className="group-row press">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-cocoa text-white"><TvIcon /></span>
              <span className="flex-1">Open TV Page</span>
              <ChevronRightIcon className="text-faint" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/e/${slug}`;
                try {
                  await navigator.clipboard.writeText(url);
                  say('Guest link copied');
                } catch {
                  say(url);
                }
              }}
              className="group-row press w-full text-left"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-ink"><LinkIcon /></span>
              <span className="flex-1">Copy Guest Link</span>
            </button>
          </div>
        </section>

        <EndModeSelect
          event={event}
          onSaved={(m) => {
            say(m);
            live.refresh();
          }}
        />

        <SyncStatus slug={slug} sync={status.sync} onChange={loadStatus} />

        <GuestEditor
          guests={live.guests}
          onAdd={(name) => settings({ guests: { add: [name] } }, `Added ${name}`)}
          onRemove={(id, name) => settings({ guests: { remove: [id] } }, `Removed ${name}`)}
        />

        <section>
          <h2 className="t-section">All songs · {live.tracks.length}</h2>
          <QueueList tracks={songs} nameOf={nameOf} canRemove={() => true} onRemove={removeSong} firstLabel={current ? 'Playing' : undefined} />
        </section>
      </div>

      <Toast msg={toast} onDone={clearToast} />
    </main>
  );
}

function PinForm({ slug, name, onDone }: { slug: string; name: string; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 pt-[max(4rem,env(safe-area-inset-top))]">
      <div className="arrive text-center">
        <p className="t-footnote font-medium text-muted">Host</p>
        <h1 className="t-large mt-1">{name}</h1>
        <p className="mt-2 text-muted">Enter the host PIN.</p>
      </div>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api(`/api/e/${slug}/host/login`, { body: { pin } });
            onDone();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something broke.');
            setPin('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="sr-only">Host PIN</span>
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            inputMode="numeric"
            type="password"
            autoComplete="one-time-code"
            autoFocus
            aria-invalid={!!error}
            className={`h-14 w-full rounded-xl bg-surface text-center text-[1.75rem] tracking-[0.5em] outline-none ring-1 focus:ring-2 focus:ring-accent ${
              error ? 'ring-2 ring-danger' : 'ring-line'
            }`}
          />
        </label>
        <p className={`t-footnote min-h-5 text-center ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
          {error ?? '4 to 6 digits'}
        </p>
        <button
          type="submit"
          disabled={busy || pin.length < 4}
          className="press btn-primary min-h-12 w-full rounded-xl text-[1.0625rem] font-semibold"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}

function GuestEditor({
  guests,
  onAdd,
  onRemove,
}: {
  guests: { id: string; name: string }[];
  onAdd: (name: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <section>
      <h2 className="t-section">Guests · {guests.length}</h2>
      <ul className="group">
        {guests.map((g) => (
          <li key={g.id} className="group-row">
            <button type="button" aria-label={`Remove ${g.name}`} onClick={() => onRemove(g.id, g.name)} className="press -ml-1 text-[1.375rem] text-danger">
              <MinusCircleIcon />
            </button>
            <Avatar name={g.name} size={28} />
            <span className="flex-1 truncate">{g.name}</span>
          </li>
        ))}
        <li>
          <form
            className="group-row py-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                onAdd(name.trim());
                setName('');
              }
            }}
          >
            <PlusIcon className="-ml-0.5 flex-none text-[1.25rem] text-ok" />
            <input
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add Guest"
              className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            />
            <button type="submit" disabled={!name.trim()} className="press font-semibold text-accent disabled:opacity-30">
              Add
            </button>
          </form>
        </li>
      </ul>
      <p className="t-footnote mt-1.5 px-4 text-muted">A name with songs can&apos;t be removed until its songs are gone</p>
    </section>
  );
}
