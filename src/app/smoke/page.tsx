// Design Ref: §11.2 step 2 — Premium-in-browser smoke test. Remove after the test.
'use client';

const TEST_VIDEOS = [
  { src: 'https://www.youtube.com/embed/kJQP7kiw5Fk?rel=0&playsinline=1', label: 'Popular music video (usually has ads without Premium)' },
  { src: 'https://www.youtube.com/embed/JGwWNGJdvx8?rel=0&playsinline=1', label: 'Popular music video #2' },
  // A channel's *current* live stream (stable link; single live video IDs end and break).
  { src: 'https://www.youtube.com/embed/live_stream?channel=UCSJ4gkVC6NrvII8umztf0Ow', label: 'Live stream (Lofi Girl, current)' },
];

export default function SmokePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Premium test</h1>
      <ol className="list-decimal space-y-1 pl-5 text-lg">
        <li>In this browser, log in to youtube.com with your Premium account.</li>
        <li>Come back here and press play on each video.</li>
        <li>Ads before or during the video = Premium does not carry over in this browser.</li>
      </ol>
      <p className="rounded-xl bg-accent-soft p-3">
        Not sure? Compare: open this page in a <b>normal</b> window and in an <b>Incognito</b> window (logged out).
        Play each music video 3 times. Ads only in Incognito = Premium works here.
      </p>
      {TEST_VIDEOS.map((v) => (
        <section key={v.src} className="space-y-2">
          <h2 className="font-semibold">{v.label}</h2>
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              className="h-full w-full"
              src={v.src}
              title={v.label}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </section>
      ))}
    </main>
  );
}
