// Design Ref: §6.2 — one place that turns results and errors into JSON responses.
import 'server-only';
import { z } from 'zod';
import { AppError } from '@/domain/errors';
import { ERRORS } from '@/domain/messages';

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

export function fail(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status },
    );
  }
  if (err instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: ERRORS.VALIDATION_ERROR.message,
          details: { fieldErrors: z.flattenError(err).fieldErrors },
        },
      },
      { status: 400 },
    );
  }
  console.error('[party-playlist] unexpected error', err);
  return Response.json({ error: { code: 'INTERNAL', message: ERRORS.INTERNAL.message } }, { status: 500 });
}

/** Wrap a route body: parse JSON safely and map any thrown error. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return fail(err);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError('VALIDATION_ERROR');
  }
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
