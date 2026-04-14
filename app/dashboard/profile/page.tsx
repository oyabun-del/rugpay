'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ordersApi, type Order } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar, ShieldCheck, Gift, ExternalLink } from 'lucide-react';

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  paid: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  processing: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const statusLabels = {
  pending: 'Ожидание оплаты',
  paid: 'Оплачен',
  processing: 'Пополнение Steam',
  completed: 'Выполнен',
  failed: 'Ошибка',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data } = await ordersApi.getMy();
        setOrders(data.orders || []);
      } finally {
        setOrdersLoading(false);
      }
    };
    loadOrders();
  }, []);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Профиль</h1>
        <p className="text-muted-foreground">Данные вашего аккаунта и реферальная информация</p>
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/history">
              <ExternalLink className="mr-2 h-4 w-4" />
              Перейти к истории заказов
            </Link>
          </Button>
          {recentOrders[0] && (
            <Button asChild>
              <Link href={`/payment/${recentOrders[0].id}`}>
                Открыть последний заказ
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl glass-subtle p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </div>
            <span className="font-medium">{user.email}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl glass-subtle p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4" />
              <span>Реферальный код</span>
            </div>
            <Badge variant="secondary" className="font-mono">{user.referral_code}</Badge>
          </div>

          <div className="flex items-center justify-between rounded-xl glass-subtle p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4" />
              <span>Реферальный баланс</span>
            </div>
            <span className="font-medium">{(user.referral_balance || 0).toFixed(2)} RUB</span>
          </div>

          <div className="flex items-center justify-between rounded-xl glass-subtle p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Дата регистрации</span>
            </div>
            <span className="font-medium">
              {new Date(user.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl glass-subtle p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>Роль</span>
            </div>
            <Badge variant="outline">{user.is_admin ? 'Администратор' : 'Пользователь'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Мои заказы</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : recentOrders.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">У вас пока нет заказов.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/">Создать заказ</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-xl glass-subtle p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">Заказ #{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <Badge variant="outline" className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/payment/${order.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Открыть
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
