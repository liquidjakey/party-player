'use client';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code + short address so guests can join from the TV screen. */
export function QrJoin({
  path,
  size = 180,
  dark = false,
  hideUrl = false,
}: {
  path: string;
  size?: number;
  dark?: boolean;
  hideUrl?: boolean;
}) {
  const [src, setSrc] = useState<string>('');
  const [url, setUrl] = useState('');
  useEffect(() => {
    const full = `${window.location.origin}${path}`;
    QRCode.toDataURL(full, {
      width: size * 2,
      margin: 1,
      color: { dark: '#1a130e', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(
      (data) => {
        setSrc(data);
        setUrl(full.replace(/^https?:\/\//, ''));
      },
      () => setSrc(''),
    );
  }, [path, size]);
  return (
    <div className="flex flex-none flex-col items-center gap-2">
      <div className="flex-none rounded-2xl bg-white p-2" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt={`QR code for ${url}`} className="h-full w-full" />}
      </div>
      {!hideUrl && <p className={`text-center font-semibold ${dark ? 'text-white/80' : 'text-muted'}`}>{url}</p>}
    </div>
  );
}
