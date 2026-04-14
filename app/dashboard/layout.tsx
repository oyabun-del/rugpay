'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  History,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { BrandLogo } from '@/components/brand-logo';

const navItems = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/dashboard/history', label: 'История заказов', icon: History },
  { href: '/dashboard/referrals', label: 'Рефералы', icon: Users },
  { href: '/dashboard/profile', label: 'Профиль', icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — liquid glass */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 glass transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRight: '1px solid oklch(1 0 0 / 0.08)' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <BrandLogo size={32} textClassName="font-bold text-sidebar-foreground" />
            <button
              className="lg:hidden p-1 text-sidebar-foreground rounded-lg hover:bg-white/[0.06] transition-colors"
              onClick={() => setSidebarOpen(false)}
            aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                    isActive
                      ? 'glass-subtle text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/[0.06] space-y-4">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl glass-subtle">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Баланс: {user.referral_balance?.toFixed(2) || '0.00'} RUB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 glass px-4 lg:px-6" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.08)' }}>
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Button asChild size="sm">
            <Link href="/">Новое пополнение</Link>
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
