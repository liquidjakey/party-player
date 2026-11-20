import { describe, expect, it } from 'vitest';
import { checkUrl, isPrivateAddress, safeFetch } from '@/server/adapters/safe-fetch';

describe('safe-fetch (used by the live-stream filler)', () => {
  it('accepts public https URLs only', () => {
    expect(checkUrl('https://www.youtube.com/@LofiGirl/live')).not.toBeNull();
    for (const bad of ['http://www.youtube.com/', 'https://127.0.0.1/', 'https://[::1]/', 'https://localhost/', 'https://printer.local/', 'file:///etc/passwd'])
      expect(checkUrl(bad)).toBeNull();
  });
  it('flags private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '142.250.1.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });
  it('refuses a redirect to a private host and never throws', async () => {
    const fake = (async () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/x' } })) as unknown as typeof fetch;
    expect(await safeFetch('https://www.youtube.com/@x/live', fake)).toBeNull();
    const boom = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await safeFetch('https://www.youtube.com/', boom)).toBeNull();
  });
});
