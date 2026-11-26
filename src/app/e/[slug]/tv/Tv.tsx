// Design Ref: §5.4 TV + FR-07 — the projector page. Follows player_state; reports ended/error/position.
// Plan SC: "After one Start party press, the TV plays the whole queue with no further input."
'use client';
import { useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import { api, ApiError } from '@/client/api';
import { useListMotion } from '@/client/use-list-motion';
import { useEventLive } from '@/client/use-event-live';
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/client/youtube-player';
import { Floaters } from '@/components/Floaters';
import { HostControls, type ControlAction } from '@/components/HostControls';
import { LeafIcon, LiveIcon } from '@/components/Icons';
import { setGuestOrder, tvColorFor } from '@/components/Avatar';
import { QrJoin } from '@/components/QrJoin';
import { GradientBackdrop, type Tone } from '@/components/GradientBackdrop';

/*
 * Option A (host decision 2026-11-19): the TV page is a fixed 1920×1080 "slide" scaled to fit any
 * screen (projector, TV browser, laptop). Nothing can be cut off; other shapes get black bars.
 * A 5% safe margin keeps content inside TV overscan.
 */
const STAGE_W = 1920;
const STAGE_H = 1080;
const SAFE_X = 96; // 5%
const SAFE_Y = 54; // 5%

function subscribeResize(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}
function useStageScale(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H),
    () => 0.5,
  );
}

function usePlayerId(): string {
  const [id] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pp_player_id');
      if (saved) return saved;
      const fresh = crypto.randomUUID();
      sessionStorage.setItem('pp_player_id', fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });
  return id;
}

export function Tv({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const live = useEventLive(slug);
  setGuestOrder(live.guests);
  const playerId = usePlayerId();
  const scale = useStageScale();
  const [started, setStarted] = useState(false);
  const [cover, setCover] = useState(true); // the start screen; fades out after the press
  const [controlError, setControlError] = useState<string | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const loaded = useRef<{ seq: number; videoId: string | null } | null>(null);
  const report = useRef({ trackId: null as string | null, playSeq: 0 });

  const { event, player, tracks } = live;
  const isActive = !player?.activePlayerId || player.activePlayerId === playerId;
  const current = tracks.find((t) => t.id === player?.currentTrackId) ?? null;
  const target =
    player?.mode === 'song' ? (current?.videoId ?? null) : player?.mode === 'live' ? (event?.liveVideoId ?? null) : null;
  const names = useMemo(() => new Map(live.guests.map((g) => [g.id, g.name])), [live.guests]);
  // Up Next: the whole queue as a compact list that fades out at the bottom (capped for TV performance).
  const upcoming = useMemo(() => upcomingOrder(tracks, player?.currentTrackId ?? null).filter((t) => t.status === 'ok'), [tracks, player?.currentTrackId]);
  const upNext = upcoming.slice(0, 24);
  const shelf = useRef<HTMLOListElement>(null);
  useListMotion(shelf, upNext.map((t) => t.id));
  // Background rotates on its own; ?bg=flow|sunrise|silk|wash|aurora|swirl pins one, ?hold=20&fade=10 speed it up to preview.
  const search = useSearchParams();
  const pinBg = search.get('bg');
  const hold = Number(search.get('hold')) || 180;
  const fade = Number(search.get('fade')) || 30;
  const [tone, setTone] = useState<Tone>('light');

  const [syncTick, forceSync] = useState(0);
  useEffect(() => {
    report.current = { trackId: player?.mode === 'song' ? (player.currentTrackId ?? null) : null, playSeq: player?.playSeq ?? 0 };
  }, [player?.mode, player?.currentTrackId, player?.playSeq]);

  // After the TV reports or a button is pressed, read the new state at once instead of waiting for a live message
  const refresh = useRef(live.refresh);
  useEffect(() => {
    refresh.current = live.refresh;
  });
  const post = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        await api(`/api/e/${slug}/player`, { body: { playerId, ...body } });
        refresh.current();
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== 'NOT_ACTIVE_PLAYER') console.warn('[tv]', e);
      }
    },
    [playerId, slug],
  );

  // Claim the player when the page opens. The newest TV tab wins.
  useEffect(() => {
    post({ action: 'claim' });
  }, [post]);

  // Buttons on the TV: previous, play/pause, next, shuffle. Allowed because this screen is the active player.
  const control = useCallback(
    (command: ControlAction) =>
      api(`/api/e/${slug}/player`, { body: { action: 'control', playerId, command } }).then(() => refresh.current()),
    [playerId, slug],
  );
  useEffect(() => {
    if (!controlError) return;
    const t = setTimeout(() => setControlError(null), 6000);
    return () => clearTimeout(t);
  }, [controlError]);

  // Keep the screen awake.
  useEffect(() => {
    if (!started) return;
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock?.request('screen') ?? null;
      } catch {
        /* not supported */
      }
    };
    ask();
    const onVis = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [started]);

  // Create the YouTube player after the "Start party" press (browsers block sound before a click).
  useEffect(() => {
    if (!started || yt.current || !holder.current) return;
    let cancelled = false;
    loadYouTubeApi().then(
      (YT) => {
        if (cancelled || !holder.current) return;
        const el = document.createElement('div');
        holder.current.appendChild(el);
        new YT.Player(el, {
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0 },
          events: {
            onReady: (e) => {
              yt.current = e.target;
              loaded.current = null; // force the sync effect to load the current target
              setYtError(null);
              forceSync((n) => n + 1);
            },
            onStateChange: (e) => {
              if (e.data === YT_STATE.ENDED) post({ action: 'ended', ...report.current });
            },
            onError: (e) => post({ action: 'error', errorCode: e.data, ...report.current }),
          },
        });
      },
      () => setYtError('Could not load the YouTube player. Check the internet connection.'),
    );
    return () => {
      cancelled = true;
    };
  }, [started, post]);

  // Follow the server: load a new video whenever play_seq or the target changes.
  useEffect(() => {
    const p = yt.current;
    if (!p || !player) return;
    if (!isActive) {
      p.pauseVideo();
      return;
    }
    const first = loaded.current === null;
    if (first || loaded.current!.seq !== player.playSeq || loaded.current!.videoId !== target) {
      loaded.current = { seq: player.playSeq, videoId: target };
      if (target) {
        p.loadVideoById({ videoId: target, startSeconds: first && player.mode === 'song' ? player.positionSec : 0 });
        if (!player.isPlaying) setTimeout(() => yt.current?.pauseVideo(), 400);
      } else {
        p.stopVideo();
      }
      return;
    }
    const state = p.getPlayerState();
    if (player.isPlaying && state === YT_STATE.PAUSED) p.playVideo();
    if (!player.isPlaying && (state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING)) p.pauseVideo();
  }, [player, target, isActive, syncTick]);

  // Save the position every 15 s so a reload resumes near the same spot.
  useEffect(() => {
    if (!started || !isActive) return;
    const t = setInterval(() => {
      const p = yt.current;
      if (p && player?.mode === 'song' && p.getPlayerState() === YT_STATE.PLAYING) {
        post({ action: 'position', positionSec: Math.floor(p.getCurrentTime()) });
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [started, isActive, player?.mode, post]);

  // Idle (party just started, or the queue was empty) and a playable song exists → start it.
  const hasPlayable = tracks.some((t) => t.status === 'ok');
  useEffect(() => {
    if (started && isActive && player?.mode === 'idle' && hasPlayable) {
      post({ action: 'ended', trackId: null, playSeq: player.playSeq });
    }
  }, [started, isActive, player?.mode, player?.playSeq, hasPlayable, post]);

  function start() {
    setStarted(true); // the video starts at once, under the fade
    setTimeout(() => setCover(false), 500);
  }

  if (live.status === 'not_found') return <Full>Party not found.</Full>;
  if (!event || !player) return <Full>Loading…</Full>;

  const joinPath = `/e/${slug}`;
  const empty = !target;
  const who = (id: string | null) => (id ? (names.get(id) ?? 'someone') : 'host');

  return (
    <main data-tone={tone} className="tv-ui fixed inset-0 overflow-hidden bg-[#1a120d]">
      {/* Rotating painterly gradient; text and cards switch light/dark halfway through each change */}
      <GradientBackdrop pin={pinBg} holdSec={hold} fadeSec={fade} onTone={setTone} />
      {/* A soft shade (dark backgrounds) or veil (light ones) only where text sits */}
      <div aria-hidden className={`absolute inset-0 transition-opacity duration-[1500ms] bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.4)),linear-gradient(90deg,transparent_62%,rgba(0,0,0,.22))] ${tone === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden className={`absolute inset-0 transition-opacity duration-[1500ms] bg-[linear-gradient(180deg,transparent_45%,rgba(255,250,244,.45)),linear-gradient(90deg,transparent_62%,rgba(255,250,244,.3))] ${tone === 'light' ? 'opacity-100' : 'opacity-0'}`} />

      <Floaters variant="tv" />

      {/* The 1920×1080 slide, centered and scaled */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      >
        <div
          className="grid h-full"
          style={{ padding: `${SAFE_Y}px ${SAFE_X}px`, gridTemplateColumns: '1fr 456px', gridTemplateRows: 'minmax(0, 1fr)', columnGap: 64 }}
        >
          {/* Stage */}
          <section className="flex min-w-0 flex-col justify-center">
            <div className="relative aspect-video w-full overflow-hidden rounded-[32px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
              <div ref={holder} className={`absolute inset-0 ${empty ? 'invisible' : ''}`} />
              {empty && started && (
                <div className="materialize absolute inset-0 grid place-items-center text-center">
                  <div className="space-y-6">
                    <p className="tv-display text-[80px] text-white">{player.mode === 'stopped' ? 'The music stopped' : 'Add a song'}</p>
                    <p className="text-[28px] text-white/60">Scan with your phone camera</p>
                    <div className="flex justify-center">
                      <QrJoin path={joinPath} size={260} dark hideUrl />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-9 flex min-h-[112px] min-w-0 items-center justify-between gap-10">
              <div className="min-w-0 flex-1">
                {player.mode === 'song' && current && (
                  <div key={current.id} className="arrive tv-halo min-w-0">
                    <p className="tv-display truncate text-[48px] text-[var(--ink)]">{current.title}</p>
                    <p className="mt-2 flex items-center gap-3 truncate text-[28px] text-[var(--ink-2)]">
                      Added by
                      <span aria-hidden className="inline-block h-4 w-4 flex-none rounded-full" style={{ background: tvColorFor(who(current.addedBy)) }} />
                      <span className="-ml-1 font-semibold text-[var(--ink)]">{who(current.addedBy)}</span>
                      {!player.isPlaying && <span> · Paused</span>}
                    </p>
                  </div>
                )}
                {player.mode === 'live' && (
                  <p className="arrive tv-halo flex items-center gap-4 text-[40px] font-semibold text-[var(--ink)]">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e0566c] text-[32px]"><LiveIcon /></span>
                    Live stream · add a song to take over
                  </p>
                )}
              </div>
              {started && (
                <div className="flex-none text-[var(--ink)]">
                  <HostControls send={control} isPlaying={player.isPlaying} size="lg" onError={setControlError} />
                </div>
              )}
            </div>
          </section>

          {/* Up Next shelf */}
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden pt-4">
            <p className="tv-halo text-[24px] font-medium text-[var(--ink-3)]">{event.name}</p>
            <h2 className="tv-display tv-halo mt-2 flex items-baseline justify-between gap-4 text-[40px] text-[var(--ink)]">
              Up Next
              {upcoming.length > 0 && (
                <span className="whitespace-nowrap font-sans text-[20px] font-medium tracking-normal text-[var(--ink-3)] tabular-nums">
                  {upcoming.length} {upcoming.length === 1 ? 'song' : 'songs'}
                </span>
              )}
            </h2>
            <ol ref={shelf} className="tv-fade relative isolate mt-6 min-h-0 flex-1 space-y-2 overflow-hidden pb-6">
              {upNext.length === 0 && <li className="text-[24px] text-[var(--ink-2)]">Nothing yet. Songs show here as guests add them</li>}
              {upNext.map((t) => (
                <li key={t.id} data-key={t.id} className="tv-row flex min-w-0 items-center gap-3.5 rounded-[20px] p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumbUrl} alt="" className="h-[56px] w-[56px] flex-none rounded-[12px] object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-[21px] font-semibold text-[var(--ink)]">{t.title}</p>
                    <p className="flex items-center gap-2 truncate text-[18px] text-[var(--ink-2)]">
                      <span aria-hidden className="inline-block h-3 w-3 flex-none rounded-full" style={{ background: tvColorFor(who(t.addedBy)) }} />
                      {who(t.addedBy)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="tv-glass mt-4 flex flex-none items-center gap-5 rounded-[28px] p-5">
              <QrJoin path={joinPath} size={140} dark hideUrl />
              <div className="min-w-0">
                <p className="text-[28px] font-semibold text-[var(--ink)]">Add a song</p>
                <p className="mt-1 text-[20px] leading-snug text-[var(--ink-2)]">Scan, pick your name, paste a YouTube link</p>
              </div>
            </div>
          </aside>
        </div>

        {live.status === 'reconnecting' && (
          <p className="tv-glass absolute left-1/2 top-8 z-20 -translate-x-1/2 rounded-full px-6 py-2.5 text-[24px] text-[var(--ink)]">Reconnecting…</p>
        )}
        {controlError && !ytError && <p role="alert" className="tv-glass absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-2xl px-7 py-3.5 text-[24px] text-[var(--ink)]">{controlError}</p>}
        {ytError && <p className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-2xl bg-[#d0302b] px-7 py-3.5 text-[24px] text-white">{ytError}</p>}
      </div>

      {cover && (
        <div
          inert={started}
          className={`absolute inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-2xl transition-opacity duration-500 ease-[var(--ease-out)] motion-reduce:duration-200 ${started ? 'pointer-events-none opacity-0' : ''}`}
        >
          <div
            className="materialize space-y-8 text-center"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
          >
            <span className="mx-auto grid h-[120px] w-[120px] place-items-center rounded-[32px] bg-[#e2622b] text-[64px] text-white">
              <LeafIcon />
            </span>
            <p className="tv-display text-[80px] text-white">{event.name}</p>
            <button
              type="button"
              autoFocus
              onClick={start}
              className="press rounded-full bg-white px-16 py-7 text-[36px] font-semibold text-[#2a1a10] outline-none transition-transform focus-visible:scale-105 focus-visible:shadow-[0_0_0_8px_rgba(255,255,255,0.35)]"
            >
              Start Party
            </button>
            <p className="text-[24px] text-white/60">Press OK on the remote</p>
          </div>
        </div>
      )}

      {started && !isActive && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 backdrop-blur-2xl">
          <div className="materialize space-y-8 text-center" style={{ transform: `scale(${scale})` }}>
            <p className="tv-display text-[60px] text-white">Playing on another screen</p>
            <button
              type="button"
              autoFocus
              onClick={() => post({ action: 'claim' })}
              className="press rounded-full bg-white px-14 py-6 text-[32px] font-semibold text-[#2a1a10] outline-none focus-visible:scale-105 focus-visible:shadow-[0_0_0_8px_rgba(255,255,255,0.35)]"
            >
              Play Here
            </button>
          </div>
        </div>
      )}

      <style>{`
        .tv-display { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; line-height: 1.08; }
        .tv-ui[data-tone='dark'] { --ink: #ffffff; --ink-2: rgba(255,255,255,.68); --ink-3: rgba(255,255,255,.52); --glass: rgba(20,12,8,.26); --glass-line: rgba(255,255,255,.12); --row: rgba(28,18,12,.66); --halo: 0 1px 2px rgba(0,0,0,.3); }
        .tv-ui[data-tone='light'] { --ink: #2a1710; --ink-2: rgba(42,23,16,.72); --ink-3: rgba(42,23,16,.55); --glass: rgba(255,250,244,.45); --glass-line: rgba(255,255,255,.6); --row: rgba(255,250,244,.8); --halo: none; }
        .tv-ui p, .tv-ui span, .tv-ui h2, .tv-ui li { transition: color 1.2s ease, background-color 1.2s ease; }
        .tv-glass { background: var(--glass); box-shadow: inset 0 0 0 1px var(--glass-line); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); transition: background-color 1.2s ease, box-shadow 1.2s ease; }
        /* Up Next rows move, so no blur here (the background behind them is already smooth) */
        .tv-row { background: var(--row); box-shadow: inset 0 0 0 1px var(--glass-line); }
        /* White text gets a faint drop shadow, like captions on photos; dark text needs none */
        .tv-halo { text-shadow: var(--halo); }
        .tv-fade { -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent); mask-image: linear-gradient(180deg, #000 55%, transparent); }
      `}</style>
    </main>
  );
}

function Full({ children }: { children: React.ReactNode }) {
  return <main className="fixed inset-0 grid place-items-center bg-[#0d0806] text-[3vmin] font-semibold text-white">{children}</main>;
}
