// Design Ref: §5.4 Guest queue — FR-03, FR-04, FR-05, FR-09. Apple-style grouped layout.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import type { Track } from '@/domain/types';
import { api, ApiError } from '@/client/api';
import { useEventLive } from '@/client/use-event-live';
import { useGuest } from '@/client/use-guest';
import { AddSongBox } from '@/components/AddSongBox';
import { Avatar, setGuestOrder } from '@/components/Avatar';
import { NavBar } from '@/components/NavBar';
import { NowPlaying } from '@/components/NowPlaying';
import { QueueList } from '@/components/QueueList';
import { Toast, type ToastMsg } from '@/components/Toast';

export function Queue({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const live = useEventLive(slug);
  const { guest, save } = useGuest(slug);
  setGuestOrder(live.guests.map((g) => g.name));
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  // No name picked, or the host removed this name → back to the picker.
  useEffect(() => {
    if (guest === null) router.replace(`/e/${slug}`);
    else if (guest && live.status === 'live' && !live.guests.some((g) => g.id === guest.id)) {
      save(null);
      router.replace(`/e/${slug}`);
    }
  }, [guest, live.status, live.guests, router, save, slug]);

  const names = useMemo(() => new Map(live.guests.map((g) => [g.id, g.name])), [live.guests]);
  const nameOf = useCallback((id: string | null) => (id ? (names.get(id) ?? 'someone') : 'host'), [names]);
  const currentId = live.player?.currentTrackId ?? null;
  const current = live.tracks.find((t) => t.id === currentId) ?? null;
  const upcoming = useMemo(() => upcomingOrder(live.tracks, currentId), [live.tracks, currentId]);
  const mineCount = live.tracks.filter((t) => t.addedBy === guest?.id).length;

  if (live.status === 'not_found') return <Center title="Party not found" text="Check the link with the host" />;
  if (!live.event || !guest) return <Center title="Loading…" />;

  /** YouTube / YouTube Music links only (search + other apps parked, see _parked/share-link-import). */
  async function add(text: string): Promise<string | null> {
    try {
      const track = await api<Track>(`/api/e/${slug}/tracks`, { body: { guestId: guest!.id, url: text } });
      setToast({ id: Date.now(), kind: 'ok', text: `Added “${track.title}”` });
      live.refresh();
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'GUEST_NOT_FOUND') save(null);
      return e instanceof ApiError ? e.message : 'Something broke. Try again.';
    }
  }

  async function remove(t: Track) {
    try {
      await api(`/api/e/${slug}/tracks/${t.id}`, { method: 'DELETE', body: { guestId: guest!.id } });
      setToast({ id: Date.now(), kind: 'ok', text: 'Removed' });
      live.refresh();
    } catch (e) {
      setToast({ id: Date.now(), kind: 'error', text: e instanceof ApiError ? e.message : 'Something broke.' });
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28">
      <NavBar
        title={live.event.name}
        trailing={
          <Link href={`/e/${slug}`} onClick={() => save(null)} className="press flex items-center gap-2" aria-label={`Signed in as ${guest.name}. Switch name`}>
            <span className="t-footnote text-muted">Not you?</span>
            <Avatar name={guest.name} size={32} />
          </Link>
        }
      />

      {live.status === 'reconnecting' && (
        <p className="t-footnote material mt-2 rounded-full px-3 py-1.5 text-center">Reconnecting…</p>
      )}

      <div className="mt-4 space-y-7">
        <NowPlaying event={live.event} player={live.player} track={current} addedByName={current ? nameOf(current.addedBy) : null} />

        <section>
          <h2 className="t-section">Add a song</h2>
          <AddSongBox onSubmit={add} />
        </section>

        <section aria-label="Queue">
          <h2 className="t-section flex items-baseline justify-between">
            <span>Up next</span>
            <span className="normal-case tracking-normal">
              {live.tracks.length} songs{mineCount ? ` · ${mineCount} yours` : ''}
            </span>
          </h2>
          <QueueList tracks={upcoming} nameOf={nameOf} canRemove={(t) => t.addedBy === guest.id} onRemove={remove} />
          {current && current.addedBy === guest.id && (
            <button type="button" onClick={() => remove(current)} className="press t-footnote mt-2 px-4 text-danger">
              Remove the song playing now
            </button>
          )}
        </section>
      </div>

      <Toast msg={toast} onDone={clearToast} />
    </main>
  );
}

function Center({ title, text }: { title: string; text?: string }) {
  return (
    <main className="grid flex-1 place-items-center px-4 text-center">
      <div>
        <h1 className="t-title">{title}</h1>
        {text && <p className="mt-1 text-muted">{text}</p>}
      </div>
    </main>
  );
}
