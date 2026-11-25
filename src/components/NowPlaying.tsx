'use client';
import type { PartyEvent, PlayerState, Track } from '@/domain/types';
import { LiveIcon } from './Icons';

/**
 * Current song, Apple Music mini-player style. While a song is on, the card takes its color from the
 * song's own artwork. Before the music starts, it shows the song that plays first. An empty queue says so.
 */
export function NowPlaying({
  player,
  track,
  addedByName,
  firstAddedBy = null,
  event,
  upNext = [],
}: {
  player: PlayerState | null;
  track: Track | null;
  addedByName: string | null;
  firstAddedBy?: string | null;
  event: PartyEvent;
  upNext?: Track[];
}) {
  const playing = player?.mode === 'song' && player.isPlaying && !!track;
  const active = player?.mode === 'song' && !!track;

  // The first song that will play: the next one in the queue, before the music starts
  const first = upNext[0] ?? null;
  const cover = (t: Track) =>
    t.thumbUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={t.thumbUrl} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
    ) : null;

  // Empty queue: say so plainly, no image
  let art: React.ReactNode = null;
  let label = event.name;
  let title = 'No songs yet';
  let sub = 'Add the first song';

  if (player?.mode === 'live') {
    art = (
      <span className="grid h-16 w-16 flex-none place-items-center rounded-xl bg-cranberry text-2xl text-white">
        <LiveIcon />
      </span>
    );
    title = 'Live stream';
    sub = 'Plays until someone adds a song';
  } else if (player?.mode === 'stopped') {
    title = 'Music stopped';
    sub = 'Add a song to start again';
  } else if (active) {
    art = cover(track);
    label = playing ? 'Now playing' : 'Paused';
    title = track.title;
    sub = `Added by ${addedByName ?? 'host'}`;
  } else if (first) {
    // Songs are waiting: show the one that plays first. It stays in the same spot when it starts.
    art = cover(first);
    label = 'Up first';
    title = first.title;
    sub = `Added by ${firstAddedBy ?? 'host'}`;
  }

  return (
    <section
      aria-label="Now playing"
      className={`np relative isolate flex items-center gap-4 overflow-hidden rounded-2xl p-4 ${active ? 'bg-[#2a1a10] text-white' : 'card'}`}
    >
      {active && track?.thumbUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.thumbUrl} alt="" aria-hidden className="np-art absolute inset-0 -z-10 h-full w-full scale-150 object-cover opacity-70 blur-2xl saturate-150" />
          <span aria-hidden className="np-art absolute inset-0 -z-10 bg-black/45" />
        </>
      )}
      {art}
      <div className="min-w-0 flex-1">
        <p className={`t-footnote mb-0.5 font-medium ${active ? 'text-white/80' : 'text-muted'}`}>{label}</p>
        <p className="t-headline truncate">{title}</p>
        <p className={`t-footnote line-clamp-2 ${active ? 'text-white/80' : 'text-muted'}`}>{sub}</p>
      </div>
      {playing && <Bars />}
      <style>{`@media (prefers-reduced-transparency: reduce) { .np-art { display: none; } }`}</style>
    </section>
  );
}

/** Small equalizer bars, the system "now playing" cue. Static under reduced motion. */
function Bars() {
  return (
    <span className="flex h-4 flex-none items-end gap-[3px] pr-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="eq w-[3px] rounded-full bg-white" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
      <style>{`
        .eq { height: 40%; animation: eq 900ms ease-in-out infinite alternate; }
        @keyframes eq { from { height: 30%; } to { height: 100%; } }
        @media (prefers-reduced-motion: reduce) { .eq { animation: none; height: 70%; } }
      `}</style>
    </span>
  );
}
