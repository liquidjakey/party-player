import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Party Playlist',
  description: 'One shared YouTube queue for the party.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f2ea' },
    { media: '(prefers-color-scheme: dark)', color: '#15100c' },
  ],
};

// Apple-design: default to the platform system font (SF on Apple devices).
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
