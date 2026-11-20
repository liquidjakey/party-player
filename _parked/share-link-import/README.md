# Parked: share-link import + song search (FR-12, FR-13)

Removed from the app on 2026-11-19 at the host's request ("YouTube links only for now").
This folder is excluded from the build, type check, lint, and tests.

What is here:
- `src/server/resolve/` — reads Spotify / Apple Music / Deezer / SoundCloud / other share links → title + artist (33 tests).
- `src/server/services/resolve-service.ts` + `src/app/api/e/[slug]/resolve/route.ts` — link or typed name → 3 YouTube matches (cached).
- `src/components/MatchPicker.tsx` — the "pick 1 of 3" list.
- `src/server/adapters/youtube-api.ts`, `youtube-fake.ts` — versions that still have `search()`.
- `Queue.with-search.tsx` — the guest page version that used all of the above.
- `tests/` — unit tests + fixtures.

To bring it back: move the files back to the same paths under `party-playlist/`, restore `search()` and the
`VideoMatch` type (`src/domain/types.ts`), and use `Queue.with-search.tsx` as the queue page.
`src/server/adapters/safe-fetch.ts` (still in the app, used by the live-stream filler) is the same as `resolve/safe-fetch.ts`.
