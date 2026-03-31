'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, User, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onLogout = () => {
    logout();
    router.push('/');
  };

  const smoothScrollToAnchor = (href: string) => {
    const targetId = href.replace('/#', '').replace('#', '');

    const tryScroll = (attempt = 0) => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `/#${targetId}`);
        return;
      }
      if (attempt < 20) {
        window.setTimeout(() => tryScroll(attempt + 1), 100);
      }
    };

    if (pathname !== '/') {
      router.push('/');
      window.setTimeout(() => tryScroll(), 60);
      return;
    }

    tryScroll();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <BrandLogo />

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/#topup"
              className="relative inline-flex items-center justify-center overflow-hidden rounded-md bg-primary/80 px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 before:absolute before:inset-0 before:bg-primary before:animate-[pulse_1.8s_ease-in-out_infinite]"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('/#topup');
              }}
            >
              <span className="relative z-10">Пополнить</span>
            </Link>
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('#features');
              }}
            >
              Преимущества
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('#how-it-works');
              }}
            >
              Как это работает
            </Link>
            <Link
              href="#faq"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('#faq');
              }}
            >
              Вопросы
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="mailto:gamecover@xraytune.ru"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Написать в техподдержку"
            >
              <Mail className="h-4 w-4" />
              <span>gamecover@xraytune.ru</span>
            </a>
            {isAuthenticated ? (
              <>
                <Button variant="ghost" onClick={onLogout}>Выйти</Button>
                <Button asChild>
                  <Link href="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Кабинет
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Вход</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Регистрация</Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Открыть меню"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/40">
            <nav className="flex flex-col gap-4">
              <a
                href="mailto:gamecover@xraytune.ru"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Техподдержка: gamecover@xraytune.ru
              </a>
              <Link
                href="/#topup"
                className="relative inline-flex items-center justify-center overflow-hidden rounded-md bg-primary/80 px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 before:absolute before:inset-0 before:bg-primary before:animate-[pulse_1.8s_ease-in-out_infinite]"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  smoothScrollToAnchor('/#topup');
                }}
              >
                <span className="relative z-10">Пополнить</span>
              </Link>
              <Link
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  smoothScrollToAnchor('#features');
                }}
              >
                Преимущества
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  smoothScrollToAnchor('#how-it-works');
                }}
              >
                Как это работает
              </Link>
              <Link
                href="#faq"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  smoothScrollToAnchor('#faq');
                }}
              >
                Вопросы
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border/40">
                {isAuthenticated ? (
                  <>
                    <Button variant="ghost" className="w-full" onClick={onLogout}>Выйти</Button>
                    <Button asChild className="w-full">
                      <Link href="/dashboard">
                        <User className="mr-2 h-4 w-4" />
                        Кабинет
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full">
                      <Link href="/login">Вход</Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/register">Регистрация</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
