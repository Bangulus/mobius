import './globals.css';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import PostHogClientProvider from './components/PostHogClientProvider';
import PostHogPageview from './components/PostHogPageview';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Möbius',
  description: 'Prediction Markets auf Deutsch',
  manifest: '/manifest.json',
  themeColor: '#1a1f3c',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Möbius',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        <PostHogClientProvider>
          <Suspense fallback={null}>
            <PostHogPageview />
          </Suspense>
          {children}
        </PostHogClientProvider>
      </body>
    </html>
  );
}
