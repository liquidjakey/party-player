// Design Ref: §7 — AES-256-GCM for the Google refresh token at rest (TOKEN_ENC_KEY, 32 bytes base64).
import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENC_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes (base64)');
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(token: string): string {
  const [iv, tag, body] = token.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}
