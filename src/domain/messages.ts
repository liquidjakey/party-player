// Design Ref: §6.1 — every error code, its HTTP status, and the plain message the user sees.

export const ERRORS = {
  VALIDATION_ERROR: { status: 400, message: "Something's missing. Try again." },
  INVALID_LINK: { status: 400, message: "That's not a YouTube link. Copy the link from YouTube (Share → Copy link)." },
  UNAUTHORIZED: { status: 401, message: 'Host login needed' },
  WRONG_PIN: { status: 401, message: 'Wrong PIN' },
  NOT_OWNER: { status: 403, message: 'You can only remove your own songs' },
  EVENT_NOT_FOUND: { status: 404, message: 'Party not found' },
  GUEST_NOT_FOUND: { status: 404, message: 'Pick your name again' },
  TRACK_NOT_FOUND: { status: 404, message: 'That song is already gone' },
  DUPLICATE: { status: 409, message: 'Already added' },
  SLUG_TAKEN: { status: 409, message: 'That short address is taken. Pick another.' },
  NOT_ACTIVE_PLAYER: { status: 409, message: 'Playing on another screen' },
  GUEST_HAS_SONGS: { status: 409, message: 'Remove their songs first' },
  VIDEO_NOT_FOUND: { status: 422, message: "This video doesn't exist or is private" },
  VIDEO_PRIVATE: { status: 422, message: "This video doesn't exist or is private" },
  NOT_EMBEDDABLE: { status: 422, message: "This video can't play here. Try another version." },
  REGION_BLOCKED: { status: 422, message: "This video can't play here. Try another version." },
  LIVE_NOT_QUEUEABLE: {
    status: 422,
    message: "Live streams can't be queued. The host can set one as the filler.",
  },
  NOT_LIVE: { status: 422, message: "This video isn't live right now" },
  PIN_LOCKED: { status: 429, message: 'Try again in 1 minute' },
  QUOTA_EXCEEDED: { status: 429, message: 'YouTube checks are full for today. Try again tomorrow.' },
  YOUTUBE_UNAVAILABLE: { status: 503, message: 'YouTube is slow. Try again.' },
  INTERNAL: { status: 500, message: 'Something broke. Try again.' },
} as const;

export type ErrorCode = keyof typeof ERRORS;

export function duplicateMessage(addedByName: string | null): string {
  return addedByName ? `Already added by ${addedByName}` : 'Already added by the host';
}
