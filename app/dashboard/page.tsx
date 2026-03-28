'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ordersApi, referralsApi, type Order, type ReferralInfo } from '@/lib/api';
import { Wallet, TrendingUp, Users, Clock, ExternalLink } from 'lucide-react';

const GUEST_EMAIL_SUFFIX = '@guest.gamecover.local';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  paid: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  processing: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const statusLabels = {
  pending: 'Ожидает оплату',
  paid: 'Оплачен',
  processing: 'Обрабатывается',
  completed: 'Завершен',
  failed: 'Ошибка',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMinutesLeft, setGuestMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersRes, referralRes] = await Promise.all([
          ordersApi.getMy(),
          referralsApi.getInfo(),
        ]);
        setOrders(ordersRes.data.orders || []);
        setReferralInfo(referralRes.data);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!user || !user.email.endsWith(GUEST_EMAIL_SUFFIX)) {
      setGuestMinutesLeft(null);
      return;
    }
    const expiresAtRaw = readCookie('guest_expires_at');
    if (!expiresAtRaw) {
      setGuestMinutesLeft(0);
      return;
    }
    const expiresAt = new Date(expiresAtRaw).getTime();
    if (Number.isNaN(expiresAt)) {
      setGuestMinutesLeft(0);
      return;
    }
    const diffMs = Math.max(0, expiresAt - Date.now());
    setGuestMinutesLeft(Math.ceil(diffMs / 60000));
  }, [user]);

  const stats = useMemo(() => {
    const totalTopups = orders.length;
    const totalSpent = orders
      .filter((o) => o.status === 'paid' || o.status === 'processing' || o.status === 'completed')
      .reduce((sum, o) => sum + o.final_amount, 0);
    return {
      totalTopups,
      totalSpent,
      referralEarnings: referralInfo?.total_earned || 0,
    };
  }, [orders, referralInfo]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Личный кабинет</h1>
        <p className="text-muted-foreground">
          С возвращением, {user?.email?.split('@')[0]}
        </p>
      </div>

      {user?.email?.endsWith(GUEST_EMAIL_SUFFIX) && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-4 text-sm">
            Войдите в{' '}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              аккаунт
            </Link>{' '}
            или{' '}
            <Link href="/register" className="font-semibold underline underline-offset-2">
              зарегистрируйтесь
            </Link>{' '}
            чтобы не потерять заказ, иначе вы потеряете его через{' '}
            <span className="font-semibold">{guestMinutesLeft ?? 0}</span> мин.
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего пополнений
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalTopups}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Потрачено
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${stats.totalSpent.toLocaleString()} RUB`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Доход с рефералов
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {loading ? '...' : `${stats.referralEarnings.toLocaleString()} RUB`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Реферальный баланс
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(user?.referral_balance || 0).toFixed(2)} RUB
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Последние операции
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Пока нет операций. Создайте первое пополнение!
            </p>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{order.steam_nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium">{order.amount.toLocaleString()} RUB</p>
                    <Badge
                      variant="outline"
                      className={statusColors[order.status]}
                    >
                      {statusLabels[order.status]}
                    </Badge>
                    <div>
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link href={`/payment/${order.id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Открыть заказ
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
