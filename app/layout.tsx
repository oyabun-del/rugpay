import type { Metadata } from 'next';
import { Exo_2, Unbounded } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { SpotlightBackground } from '@/components/spotlight-background';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const exo2 = Exo_2({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rugpay.ru'

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'RugPay',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'gamecover@xraytune.ru',
    contactType: 'customer service',
    availableLanguage: 'Russian',
  },
  sameAs: [],
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'RugPay — Пополнение Steam и PUBG Mobile',
    template: '%s | RugPay',
  },
  description: 'Быстрое и безопасное пополнение Steam-кошелька и PUBG Mobile UC с минимальной комиссией. Оплата картой, моментальное зачисление.',
  keywords: ['Steam', 'пополнение Steam', 'PUBG Mobile UC', 'купить UC', 'пополнение кошелька Steam', 'игровой баланс'],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: BASE_URL,
    siteName: 'RugPay',
    title: 'RugPay — Пополнение Steam и PUBG Mobile',
    description: 'Быстрое и безопасное пополнение Steam-кошелька и PUBG Mobile UC с минимальной комиссией.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RugPay — Пополнение Steam и PUBG Mobile',
    description: 'Быстрое и безопасное пополнение Steam-кошелька и PUBG Mobile UC.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${exo2.variable} ${unbounded.variable} font-sans antialiased relative overflow-x-hidden`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          <SpotlightBackground />
          <div className="relative z-10">
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
