// Design Ref: §10.4 — services throw AppError; src/server/http.ts maps it to a response once.
import { ERRORS, type ErrorCode } from './messages';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>, message?: string) {
    super(message ?? ERRORS[code].message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERRORS[code].status;
    this.details = details;
  }
}
