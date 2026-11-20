// Design Ref: §8.6 — test event "test" with 7 guests and 3 fake tracks. Uses the service key from .env.local.
import 'dotenv/config';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  await sb.from('events').delete().eq('slug', 'test');
  const { data: ev, error } = await sb.from('events').insert({ slug: 'test', name: 'Test Party', region: 'KR' }).select().single();
  if (error) throw error;
  await sb.from('event_secrets').insert({ event_id: ev.id, host_pin_hash: await bcrypt.hash('1234', 10) });
  await sb.from('player_state').insert({ event_id: ev.id });
  const names = ['Maya', 'Daniel', 'Priya', 'Marcus', 'Sofia', 'Kenji', 'Olivia'];
  const { data: guests } = await sb.from('guests').insert(names.map((name) => ({ event_id: ev.id, name }))).select();
  const g = (n: string) => guests!.find((x) => x.name === n)!.id;
  const now = Date.now();
  await sb.from('tracks').insert([
    { event_id: ev.id, video_id: 'okSong00001', title: 'Fake Song One', channel: 'Fake', thumb_url: '', duration_sec: 30, added_by: g('Maya'), added_at: new Date(now - 3000).toISOString(), first_played_at: new Date(now - 1000).toISOString(), last_played_at: new Date(now - 1000).toISOString() },
    { event_id: ev.id, video_id: 'okSong00002', title: 'Fake Song Two', channel: 'Fake', thumb_url: '', duration_sec: 30, added_by: g('Kenji'), added_at: new Date(now - 2000).toISOString() },
    { event_id: ev.id, video_id: 'okSong00003', title: 'Fake Song Three', channel: 'Fake', thumb_url: '', duration_sec: 30, added_by: g('Daniel'), added_at: new Date(now - 1000).toISOString() },
  ]);
  console.log('Seeded event "test" (host PIN 1234) with 7 guests and 3 tracks.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
