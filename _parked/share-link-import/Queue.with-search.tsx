// Design Ref: §5.4 Guest queue — FR-03, FR-04, FR-05, FR-09.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import type { Track, VideoMatch } from '@/domain/types';
import { parseYouTubeUrl } from '@/domain/youtube-url';
import { api, ApiError } from '@/client/api';
import { useEventLive } from '@/client/use-event-live';
import { useGuest } from '@/client/use-guest';
import { AddSongBox } from '@/components/AddSongBox';
import { MatchPicker } from '@/components/MatchPicker';
import { NowPlaying } from '@/components/NowPlaying';
import { QueueList } from '@/components/QueueList';
import { Toast, type ToastMsg } from '@/components/Toast';

export function Queue({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const live = useEventLive(slug);
  const { guest, save } = useGuest(slug);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [picker, setPicker] = useState<{ heading: string; matches: VideoMatch[]; sourceUrl?: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

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

  if (live.status === 'not_found') return <p className="p-8 text-center">Party not found.</p>;
  if (!live.event || !guest) return <p className="p-8 text-center text-muted">Loading…</p>;

  async function addTrack(body: Record<string, unknown>): Promise<string | null> {
    try {
      const track = await api<Track>(`/api/e/${slug}/tracks`, { body: { guestId: guest!.id, ...body } });
      setToast({ id: Date.now(), kind: 'ok', text: `Added “${track.title}”` });
      live.refresh();
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'GUEST_NOT_FOUND') save(null);
      return e instanceof ApiError ? e.message : 'Something broke. Try again.';
    }
  }

  /** YouTube link → add now. Any other link or typed name → show 3 matches (FR-12, FR-13). */
  async function add(text: string): Promise<string | null> {
    setPicker(null);
    if (parseYouTubeUrl(text)) return addTrack({ url: text });
    const isLink = /https?:\/\//i.test(text);
    try {
      const res = await api<{ source: { title?: string; artist?: string | null }; matches: VideoMatch[] }>(
        `/api/e/${slug}/resolve`,
        { body: { guestId: guest!.id, ...(isLink ? { url: text } : { query: text }) } },
      );
      const what = [res.source.title, res.source.artist].filter(Boolean).join(' — ');
      setPicker({
        heading: isLink && what ? `Which one is “${what}”?` : `Results for “${text}”`,
        matches: res.matches,
        sourceUrl: isLink ? (text.match(/https?:\/\/\S+/)?.[0] ?? undefined) : undefined,
      });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Something broke. Try again.';
    }
  }

  async function pick(m: VideoMatch) {
    setAdding(m.videoId);
    const err = await addTrack({ videoId: m.videoId, ...(picker?.sourceUrl ? { sourceUrl: picker.sourceUrl } : {}) });
    setAdding(null);
    if (err) setToast({ id: Date.now(), kind: 'error', text: err });
    else setPicker(null);
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
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 pt-5 pb-24">
      <header className="flex items-center justify-between gap-3">
        <h1 className="truncate font-display text-2xl font-bold">{live.event.name}</h1>
        <div className="flex-none text-right text-sm">
          <p className="font-semibold">{guest.name}</p>
          <Link
            href={`/e/${slug}`}
            onClick={() => save(null)}
            className="text-muted underline underline-offset-2"
          >
            Not you?
          </Link>
        </div>
      </header>

      {live.status === 'reconnecting' && (
        <p className="rounded-xl bg-line px-3 py-2 text-center text-sm">Reconnecting…</p>
      )}

      <NowPlaying event={live.event} player={live.player} track={current} addedByName={current ? nameOf(current.addedBy) : null} />

      <AddSongBox onSubmit={add} />
      {picker && (
        <MatchPicker heading={picker.heading} matches={picker.matches} busyId={adding} onPick={pick} onCancel={() => setPicker(null)} />
      )}

      <section aria-label="Queue" className="space-y-2">
        <h2 className="flex items-baseline justify-between text-lg font-semibold">
          Up next <span className="text-sm font-normal text-muted">{live.tracks.length} songs total</span>
        </h2>
        <QueueList
          tracks={upcoming}
          nameOf={nameOf}
          canRemove={(t) => t.addedBy === guest.id}
          onRemove={remove}
        />
        {current && current.addedBy === guest.id && (
          <button
            type="button"
            onClick={() => remove(current)}
            className="text-sm text-muted underline underline-offset-2"
          >
            Remove the song playing now (yours)
          </button>
        )}
      </section>

      <Toast msg={toast} onDone={clearToast} />
    </main>
  );
}
