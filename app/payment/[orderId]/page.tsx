'use client';

import { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { paymentsApi, type PaymentOrderInfo } from '@/lib/api';
import { BrandLogo } from '@/components/brand-logo';

type OrderStatus = 'pending' | 'paid' | 'processing' | 'completed' | 'failed';
const POLL_INTERVAL_MS = 5000;

const statusConfig = {
  pending: {
    label: 'Ожидает оплату',
    icon: Clock,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  paid: {
    label: 'Оплата получена',
    icon: CheckCircle2,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  processing: {
    label: 'Идет обработка',
    icon: Loader2,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  completed: {
    label: 'Пополнение завершено',
    icon: CheckCircle2,
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  failed: {
    label: 'Ошибка пополнения',
    icon: XCircle,
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
};

function mapApiStatusToUi(status: string): OrderStatus {
  const s = status?.toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'failed' || s === 'declined' || s === 'cancelled') return 'failed';
  if (s === 'paid' || s === 'processing') return s as OrderStatus;
  return 'pending';
}

function mapDisplayStatus(status: string, returnStatus: string | null): OrderStatus {
  const apiStatus = mapApiStatusToUi(status);
  if (returnStatus === 'fail') return 'failed';
  if (returnStatus === 'success' && apiStatus === 'pending') {
    // User has returned from successful payment redirect, but webhook/sync may still be catching up.
    return 'paid';
  }
  return apiStatus;
}

export default function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const searchParams = useSearchParams();
  const returnStatus = searchParams.get('status');
  const [order, setOrder] = useState<(PaymentOrderInfo & { displayStatus: OrderStatus }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = parseInt(orderId, 10);
    if (Number.isNaN(id)) {
      setLoading(false);
      setFetchError('Некорректный номер заказа');
      return;
    }

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const fetchOrder = async (isInitial = false) => {
      try {
        const { data } = await paymentsApi.getOrderForPage(id);
        const displayStatus = mapDisplayStatus(data.status, returnStatus);
        setOrder({
          ...data,
          displayStatus,
        });
        setPayError(null);
        setFetchError(null);

        if (displayStatus === 'completed' || displayStatus === 'failed') {
          stopPolling();
        }
      } catch {
        setFetchError('Заказ не найден');
        setOrder(null);
      } finally {
        if (isInitial) setLoading(false);
      }
    };

    fetchOrder(true);
    pollRef.current = setInterval(() => {
      void fetchOrder(false);
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [orderId, returnStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order || fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold mb-4">{fetchError || 'Заказ не найден'}</h1>
        <Button asChild>
          <Link href="/">Вернуться на главную</Link>
        </Button>
      </div>
    );
  }

  const status = order.displayStatus;
  const StatusIcon = statusConfig[status].icon;
  const statusStepIndex: Record<OrderStatus, number> = {
    pending: 0,
    paid: 1,
    processing: 2,
    completed: 3,
    failed: 2,
  };
  const currentStep = statusStepIndex[status];
  const flowSteps = [
    'Ожидание оплаты',
    'Оплата получена',
    'Пополнение Steam',
    'Выполнено',
  ];

  const handlePayNow = async () => {
    setPayError(null);
    setPayLoading(true);
    try {
      const { data } = await paymentsApi.getPayLink(order.id);
      if (data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      setPayError('Не удалось получить ссылку на оплату');
    } catch {
      setPayError('Не удалось получить ссылку на оплату');
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-lg mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <BrandLogo size={40} textClassName="text-2xl font-bold" />
            </div>
            <CardTitle className="text-xl">Заказ #{String(order.id).slice(-8)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/50 mb-4">
                <StatusIcon
                  className={`h-8 w-8 ${
                    status === 'processing' ? 'animate-spin' : ''
                  } ${
                    status === 'completed'
                      ? 'text-green-500'
                      : status === 'failed'
                        ? 'text-red-500'
                        : 'text-primary'
                  }`}
                />
              </div>
              <Badge variant="outline" className={statusConfig[status].color}>
                {statusConfig[status].label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Статус обновляется автоматически каждые 5 секунд
              </p>
            </div>

            {/* Order flow */}
            <div className="space-y-3 rounded-lg bg-secondary/20 p-4">
              <p className="text-sm font-medium">Этапы обработки заказа</p>
              {flowSteps.map((step, index) => {
                const isDone = status !== 'failed' && index < currentStep;
                const isCurrent = index === currentStep;
                const isFailedCurrent = status === 'failed' && isCurrent;
                const circleClass = isFailedCurrent
                  ? 'bg-red-500 text-white'
                  : isDone
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'bg-muted text-muted-foreground';
                const textClass = isFailedCurrent
                  ? 'text-red-500'
                  : isDone || isCurrent
                    ? 'text-foreground'
                    : 'text-muted-foreground';

                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circleClass}`}
                    >
                      {index + 1}
                    </div>
                    <span className={`text-sm ${textClass}`}>{step}</span>
                  </div>
                );
              })}
            </div>

            {/* Order details */}
            <div className="space-y-3 rounded-lg bg-secondary/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Steam-аккаунт</span>
                <span className="font-medium">{order.steam_nickname}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Сумма пополнения</span>
                <span>{order.amount.toLocaleString()} RUB</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-semibold">
                <span>Итого</span>
                <span className="text-primary">
                  {order.final_amount.toLocaleString()} RUB
                </span>
              </div>
            </div>

            {/* Success message */}
            {status === 'completed' && (
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-green-500 font-medium">
                  Баланс Steam успешно пополнен!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Средства уже доступны в вашем Steam-кошельке.
                </p>
              </div>
            )}

            {/* Pending payment message */}
            {status === 'pending' && (
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-500 font-medium">Ожидание оплаты</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Заказ создан, но платеж еще не подтвержден.
                </p>
                <Button className="mt-4" onClick={handlePayNow} disabled={payLoading}>
                  {payLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Переход к оплате...
                    </>
                  ) : (
                    'Перейти к оплате'
                  )}
                </Button>
                {payError && <p className="text-xs text-destructive mt-2">{payError}</p>}
              </div>
            )}

            {/* Failed message */}
            {status === 'failed' && (
              <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-500 font-medium">
                  Пополнение не выполнено
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Попробуйте снова или обратитесь в поддержку.
                </p>
                <Button className="mt-4" variant="outline">
                  Связаться с поддержкой
                </Button>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Подтверждение заказа отправлено на {order.email}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
