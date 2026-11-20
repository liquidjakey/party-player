'use client';
import type { PartyEvent, PlayerState, Track } from '@/domain/types';
import { LeafIcon, LiveIcon } from './Icons';

/** Current song, Apple Music mini-player style: artwork, title, who added it. */
export function NowPlaying({
  player,
  track,
  addedByName,
  event,
}: {
  player: PlayerState | null;
  track: Track | null;
  addedByName: string | null;
  event: PartyEvent;
}) {
  let art: React.ReactNode = (
    <span className="grid h-16 w-16 flex-none place-items-center rounded-xl bg-accent-soft text-2xl text-accent">
      <LeafIcon />
    </span>
  );
  let title = 'Not started yet';
  let sub = 'Add songs now. They play in order when the party starts.';

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
  } else if (track) {
    art = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={track.thumbUrl} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
    );
    title = track.title;
    sub = `Added by ${addedByName ?? 'host'}`;
  }

  const playing = player?.mode === 'song' && player.isPlaying && !!track;
  const active = player?.mode === 'song' && !!track;
  // Moment: while a song is on, the card takes its color from the song's own artwork.
  return (
    <section
      aria-label="Now playing"
      className={`relative isolate flex items-center gap-4 overflow-hidden rounded-2xl p-4 ${active ? 'bg-[#2a1a10] text-white' : 'card'}`}
    >
      {active && track && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.thumbUrl} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-150 object-cover opacity-70 blur-2xl saturate-150" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-black/35" />
        </>
      )}
      {art}
      <div className="min-w-0 flex-1">
        <p className={`t-footnote mb-0.5 font-medium ${active ? 'text-white/75' : 'text-muted'}`}>
          {playing ? 'Now playing' : active ? 'Paused' : event.name}
        </p>
        <p className="t-headline truncate">{title}</p>
        <p className={`t-footnote truncate ${active ? 'text-white/75' : 'text-muted'}`}>{sub}</p>
      </div>
      {playing && <Bars />}
    </section>
  );
}

/** Small equalizer bars, the system "now playing" cue. Static under reduced motion. */
function Bars() {
  return (
    <span className="flex h-4 flex-none items-end gap-[3px] pr-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq w-[3px] rounded-full bg-white"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
      <style>{`
        .eq { height: 40%; animation: eq 900ms ease-in-out infinite alternate; }
        @keyframes eq { from { height: 30%; } to { height: 100%; } }
        @media (prefers-reduced-motion: reduce) { .eq { animation: none; height: 70%; } }
      `}</style>
    </span>
  );
}
