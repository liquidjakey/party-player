# Party Playlist

One shared YouTube queue for a party. Guests open a link on their phone, tap their name and paste YouTube links. The TV page plays the queue non-stop on a projector or TV browser, over a slowly changing painted background.

**Try it:** https://party-player-two.vercel.app — create a party, share the guest link, open the TV link on the big screen.

## How it works

| Page | Who | What |
|---|---|---|
| `/` | Host | Create a party: name, guest list, host PIN |
| `/e/{party}` | Guests | Pick your name (no account, no password) |
| `/e/{party}/queue` | Guests | See what's playing, add YouTube links, remove your own songs |
| `/e/{party}/tv` | The big screen | Plays the queue, shows Up Next and a QR code to join |
| `/e/{party}/host` | Host (PIN) | Play/pause/skip/back, guests, party name, what happens after the last song |

- **Checked links.** A song is only added if YouTube says the video exists, is public or unlisted, can be embedded, and isn't blocked in the party's country.
- **Fair order.** Songs that have never played go first, so a song added late doesn't wait behind the whole loop.
- **After the last song:** loop, stop, or play a YouTube live stream until someone adds a song.
- **Live everywhere.** Every phone and the TV update within about a second (Supabase Realtime).
- **Optional backup.** The host can copy every song into a playlist on their own YouTube account, to cast from the YouTube app if the TV page fails.

YouTube Premium: log in to YouTube in the TV's browser and the embedded player plays without ads.

## Run your own copy

You need free accounts on **Supabase**, **Google Cloud** and **Vercel**.

1. **Database.** Create a Supabase project. In *SQL Editor*, run the files in `supabase/migrations/` in order (`0001`, `0002`, `0003`).
2. **YouTube key.** In Google Cloud, enable *YouTube Data API v3* and create an API key (restrict it to that API).
3. **Settings.** Copy `.env.example` to `.env.local` and fill it in:

   | Name | What |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (Project URL, publishable key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (server only, never share it) |
   | `YOUTUBE_API_KEY` | The key from step 2 |
   | `SESSION_SECRET` | `openssl rand -base64 48` |
   | `TOKEN_ENC_KEY` | `openssl rand -base64 32` |
   | `ADMIN_PIN` | *Optional.* Set it to lock party creation to people who know it. Leave empty to let anyone create parties |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` | *Optional,* only for the YouTube backup playlist (a Google OAuth client with redirect `APP_URL/api/google/callback`) |

4. **Run it.**
   ```bash
   npm install
   npm run build && npm start   # http://localhost:3000
   ```
5. **Deploy.** Import the repo in Vercel and add the same settings under *Environment Variables*.

## Development

```bash
npm test                 # unit tests (link parsing, video checks, song order, PIN lock)
YOUTUBE_FAKE=1 npm start # fake YouTube, no key needed
npm run seed             # a "test" party with sample songs
npm run test:api         # API tests against the running app
```

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase and the YouTube IFrame Player. The TV background is a small WebGL shader.

## Limits

- The site's YouTube key allows about 9,500 song checks per day for all parties together.
- On an open site, one connection can create at most 5 parties per hour.
- Guests are trusted: anyone can tap any name. The host can remove any song or guest.
