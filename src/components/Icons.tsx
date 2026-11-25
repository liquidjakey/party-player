// SF Symbols–like glyphs as inline SVG (currentColor, 1em). Decorative unless a label is passed.
type P = { className?: string; label?: string };
const svg = (path: React.ReactNode, { className, label }: P, viewBox = '0 0 24 24') => (
  <svg
    viewBox={viewBox}
    width="1em"
    height="1em"
    className={className}
    fill="currentColor"
    aria-hidden={label ? undefined : true}
    role={label ? 'img' : undefined}
    aria-label={label}
  >
    {path}
  </svg>
);

export const PlayIcon = (p: P) => svg(<path d="M7 4.6v14.8c0 .9 1 1.5 1.8 1l12-7.4c.7-.5.7-1.5 0-2L8.8 3.6C8 3.1 7 3.7 7 4.6Z" />, p);
export const PauseIcon = (p: P) =>
  svg(
    <>
      <rect x="5.5" y="4" width="4.5" height="16" rx="1.4" />
      <rect x="14" y="4" width="4.5" height="16" rx="1.4" />
    </>,
    p,
  );
export const ForwardIcon = (p: P) =>
  svg(<path d="M2.5 6.2v11.6c0 .8.9 1.3 1.6.8l8.2-5.8c.6-.4.6-1.2 0-1.6L4.1 5.4c-.7-.5-1.6 0-1.6.8Zm9.5 0v11.6c0 .8.9 1.3 1.6.8l8.2-5.8c.6-.4.6-1.2 0-1.6l-8.2-5.8c-.7-.5-1.6 0-1.6.8Z" />, p);
export const BackwardIcon = (p: P) =>
  svg(<path d="M21.5 6.2v11.6c0 .8-.9 1.3-1.6.8l-8.2-5.8c-.6-.4-.6-1.2 0-1.6l8.2-5.8c.7-.5 1.6 0 1.6.8Zm-9.5 0v11.6c0 .8-.9 1.3-1.6.8l-8.2-5.8c-.6-.4-.6-1.2 0-1.6l8.2-5.8c.7-.5 1.6 0 1.6.8Z" />, p);
export const PlusIcon = (p: P) => svg(<path d="M12 4.5a1.2 1.2 0 0 1 1.2 1.2v5.1h5.1a1.2 1.2 0 1 1 0 2.4h-5.1v5.1a1.2 1.2 0 1 1-2.4 0v-5.1H5.7a1.2 1.2 0 1 1 0-2.4h5.1V5.7A1.2 1.2 0 0 1 12 4.5Z" />, p);
export const MinusCircleIcon = (p: P) =>
  svg(<path d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm-4.6 8.3a1.2 1.2 0 1 0 0 2.4h9.2a1.2 1.2 0 1 0 0-2.4H7.4Z" />, p);
export const ChevronRightIcon = (p: P) => svg(<path d="M9.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 1 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4Z" />, p);
export const CheckIcon = (p: P) => svg(<path d="M19.7 6.3a1 1 0 0 1 0 1.4l-9.5 9.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 1 1 1.4-1.4l3.8 3.8 8.8-8.8a1 1 0 0 1 1.4 0Z" />, p);
export const WarningIcon = (p: P) =>
  svg(<path d="M10.3 3.6a2 2 0 0 1 3.4 0l8 13.9a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3l8-13.9ZM12 8.5a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Zm0 7.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />, p);
export const MusicIcon = (p: P) =>
  svg(<path d="M19 3.3v11.9a3.3 3.3 0 1 1-2-3V7.6l-7 1.6v8a3.3 3.3 0 1 1-2-3V6.4c0-.5.3-.9.8-1l9-2.1c.6-.1 1.2.3 1.2 1Z" />, p);
export const TvIcon = (p: P) =>
  svg(<path d="M4 4.5h16a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Zm4 15.5h8a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z" />, p);
export const LinkIcon = (p: P) =>
  svg(<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0Zm-1.3 5.3a4 4 0 0 1-5.7-5.7l2.8-2.8a1 1 0 1 1 1.4 1.4L5 14.4a2 2 0 1 0 2.8 2.8l2.8-2.8a1 1 0 1 1 1.4 1.4l-2.7 2.9Zm9.4-5.6a1 1 0 0 1-1.4-1.4L20 8.9a2 2 0 1 0-2.8-2.8l-2.8 2.8A1 1 0 1 1 13 7.5l2.8-2.8a4 4 0 0 1 5.7 5.7l-2.8 2.7Z" />, p);
export const LiveIcon = (p: P) =>
  svg(<path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6.3 6.3a1 1 0 0 1 0 1.4 6 6 0 0 0 0 8.6 1 1 0 1 1-1.4 1.4 8 8 0 0 1 0-11.4 1 1 0 0 1 1.4 0Zm11.4 0a1 1 0 0 1 1.4 0 8 8 0 0 1 0 11.4 1 1 0 1 1-1.4-1.4 6 6 0 0 0 0-8.6 1 1 0 0 1 0-1.4Z" />, p);
export const LeafIcon = (p: P) =>
  svg(<path d="M20.6 3.4a1 1 0 0 0-.9-.3C11.3 4.3 5.2 7.9 4.1 14.2c-.3 1.6-.1 3 .4 4.2l-1.8 1.8a1 1 0 1 0 1.4 1.4l1.8-1.8c1.2.6 2.6.8 4.2.5 6.3-1.1 9.9-7.2 11.1-15.6a1 1 0 0 0-.3-.9Zm-9.9 14.7c-1 .2-1.9.1-2.7-.2l5.3-5.3a1 1 0 0 0-1.4-1.4l-5.3 5.3c-.3-.8-.4-1.7-.2-2.7.9-4.9 5.5-8 12-9.3-1.3 6.5-4.4 11.1-9.3 12Z" />, p);
/** Three lines: the iOS reorder handle */
export const GripIcon = (p: P) =>
  svg(
    <>
      <rect x="4" y="6.2" width="16" height="1.8" rx=".9" />
      <rect x="4" y="11.1" width="16" height="1.8" rx=".9" />
      <rect x="4" y="16" width="16" height="1.8" rx=".9" />
    </>,
    p,
  );
export const ShuffleIcon = (p: P) =>
  svg(
    <g fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H21" />
      <path d="M3 17h3.2c1.6 0 3-.8 3.9-2.1l.5-.7M13.4 9.8l.5-.7C14.8 7.8 16.2 7 17.8 7H21" />
      <path d="m18.3 4.3 2.7 2.7-2.7 2.7M18.3 14.3 21 17l-2.7 2.7" />
    </g>,
    p,
  );
