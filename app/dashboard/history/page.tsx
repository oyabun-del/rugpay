'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ordersApi, type Order } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { History, ExternalLink } from 'lucide-react';

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

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await ordersApi.getMy();
        setOrders(data.orders || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">История заказов</h1>
        <p className="text-muted-foreground">
          Все ваши пополнения и их статусы
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Все операции
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Загрузка...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Пока нет операций.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Ник Steam</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="text-right">Комиссия</TableHead>
                    <TableHead className="text-right">Итого</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.order_type === 'pubg'
                          ? `PUBG: ${order.pubg_uid || '—'}`
                          : order.steam_nickname || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.amount.toLocaleString()} RUB
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {order.commission.toLocaleString()} RUB
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {order.final_amount.toLocaleString()} RUB
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[order.status]}
                        >
                          {statusLabels[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/payment/${order.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Открыть
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
