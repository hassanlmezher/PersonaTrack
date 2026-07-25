import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PersonaTrace – OSINT Intelligence Platform',
  description:
    'Elite OSINT intelligence platform for digital exposure analysis, facial biometric matching, and threat mapping.',
  keywords: ['OSINT', 'security research', 'digital footprint', 'threat intelligence'],
  authors: [{ name: 'PersonaTrace' }],
  robots: 'noindex,nofollow',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#08090C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black min-h-screen flex items-center justify-center overflow-hidden">
        {children}
      </body>
    </html>
  );
}
