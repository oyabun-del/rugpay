'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, User, Mail } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const closeMobileMenu = useCallback(() => {
    if (!mobileMenuOpen || menuClosing) return;
    setMenuClosing(true);
    const el = menuRef.current;
    if (el) {
      el.addEventListener('animationend', () => {
        setMobileMenuOpen(false);
        setMenuClosing(false);
      }, { once: true });
    } else {
      setMobileMenuOpen(false);
      setMenuClosing(false);
    }
  }, [mobileMenuOpen, menuClosing]);

  const toggleMobileMenu = useCallback(() => {
    if (mobileMenuOpen) {
      closeMobileMenu();
    } else {
      setMobileMenuOpen(true);
    }
  }, [mobileMenuOpen, closeMobileMenu]);

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
    <header className="sticky top-0 z-50 w-full glass border-b-0" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.08)' }}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <BrandLogo />

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/#topup"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_2px_12px_-2px_oklch(0.65_0.24_270_/_0.4)] transition-all duration-300 hover:shadow-[0_4px_20px_-2px_oklch(0.65_0.24_270_/_0.5)] hover:bg-primary/90 animate-[liquid-pulse_2.5s_ease-in-out_infinite]"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('/#topup');
              }}
            >
              Пополнить
            </Link>
            <Link
              href="/#games"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('/#games');
              }}
            >
              Каталог
            </Link>
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('#features');
              }}
            >
              Преимущества
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                smoothScrollToAnchor('#how-it-works');
              }}
            >
              Как это работает
            </Link>
            <Link
              href="#faq"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
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
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
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
            className="md:hidden p-2 rounded-xl hover:bg-accent/15 transition-colors duration-300"
            onClick={toggleMobileMenu}
            aria-label="Открыть меню"
          >
            <span className="relative block h-6 w-6">
              <Menu className={`h-6 w-6 absolute inset-0 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'}`} />
              <X className={`h-6 w-6 absolute inset-0 transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'}`} />
            </span>
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            ref={menuRef}
            className={`md:hidden py-4 border-t border-white/[0.08] ${menuClosing ? 'animate-menu-close' : 'animate-menu-open'}`}
          >
            <nav className="flex flex-col gap-4">
              <a
                href="mailto:gamecover@xraytune.ru"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                onClick={closeMobileMenu}
              >
                Техподдержка: gamecover@xraytune.ru
              </a>
              <Link
                href="/#topup"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_2px_12px_-2px_oklch(0.65_0.24_270_/_0.4)] transition-all duration-300"
                onClick={(e) => {
                  e.preventDefault();
                  closeMobileMenu();
                  smoothScrollToAnchor('/#topup');
                }}
              >
                Пополнить
              </Link>
              <Link
                href="/#games"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                onClick={(e) => {
                  e.preventDefault();
                  closeMobileMenu();
                  smoothScrollToAnchor('/#games');
                }}
              >
                Каталог
              </Link>
              <Link
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                onClick={(e) => {
                  e.preventDefault();
                  closeMobileMenu();
                  smoothScrollToAnchor('#features');
                }}
              >
                Преимущества
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                onClick={(e) => {
                  e.preventDefault();
                  closeMobileMenu();
                  smoothScrollToAnchor('#how-it-works');
                }}
              >
                Как это работает
              </Link>
              <Link
                href="#faq"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                onClick={(e) => {
                  e.preventDefault();
                  closeMobileMenu();
                  smoothScrollToAnchor('#faq');
                }}
              >
                Вопросы
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.08]">
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
