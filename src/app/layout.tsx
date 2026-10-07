import type { Metadata, Viewport } from 'next';
import '../styles.css';

export const metadata: Metadata = {
  title: 'Grandes Obras HJCB',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'HJCB',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#153a5b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
