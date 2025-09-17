import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { SkipLinks } from '@/components/ui/skip-links';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'GlobalTaxCalc - Free Tax Calculator',
    template: '%s | GlobalTaxCalc',
  },
  description: 'Free, accurate tax calculator for individuals and businesses. Calculate your taxes, find deductions, and maximize your refund.',
  keywords: ['tax calculator', 'tax refund', 'income tax', 'deductions', 'free tax calculator'],
  authors: [{ name: 'GlobalTaxCalc Team' }],
  creator: 'GlobalTaxCalc',
  publisher: 'GlobalTaxCalc',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://globaltaxcalc.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'es-ES': '/es-ES',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://globaltaxcalc.com',
    title: 'GlobalTaxCalc - Free Tax Calculator',
    description: 'Free, accurate tax calculator for individuals and businesses. Calculate your taxes, find deductions, and maximize your refund.',
    siteName: 'GlobalTaxCalc',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GlobalTaxCalc - Free Tax Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GlobalTaxCalc - Free Tax Calculator',
    description: 'Free, accurate tax calculator for individuals and businesses.',
    images: ['/og-image.png'],
    creator: '@globaltaxcalc',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  verification: {
    google: 'google-site-verification-token',
    yandex: 'yandex-verification-token',
    yahoo: 'yahoo-site-verification-token',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />

        {/* Progressive Web App meta tags */}
        <meta name="application-name" content="GlobalTaxCalc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GlobalTaxCalc" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3b82f6" />

        {/* Viewport configuration */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, shrink-to-fit=no, user-scalable=yes, viewport-fit=cover"
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <SkipLinks />
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {children}
              </div>
              <Toaster
                position="top-right"
                toastOptions={{
                  className: '',
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </QueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}