import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { SpotlightBackground } from '@/components/spotlight-background';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const _geist = Geist({ subsets: ['latin'] });
const _geistMono = Geist_Mono({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RugPay - Пополнение баланса Steam',
  description: 'Быстрое и безопасное пополнение Steam-кошелька с низкой комиссией.',
  keywords: ['Steam', 'пополнение', 'кошелек', 'игры', 'Россия', 'PUBG Mobile'],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased relative overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SpotlightBackground />
          <div className="relative z-10">
            <AuthProvider>
              {children}
              <ThemeToggle />
              <Toaster />
            </AuthProvider>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
