'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { referralsApi, type ReferralInfo } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Copy, CheckCircle2, Link, Wallet, TrendingUp } from 'lucide-react';

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await referralsApi.getInfo();
        setReferralInfo(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const referralCode = referralInfo?.referral_code || user?.referral_code || 'XXXXX';
  const referralLink = referralInfo?.referral_link || (
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${referralCode}`
      : `https://steampay.ru/?ref=${referralCode}`
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Реферальная программа</h1>
        <p className="text-muted-foreground">
          Приглашайте друзей и получайте вознаграждение с их заказов
        </p>
      </div>

      {/* Referral link card */}
      <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Ваша реферальная ссылка
          </CardTitle>
          <CardDescription>
            Поделитесь ссылкой с друзьями. Вы получаете 10% от комиссии с каждого их заказа.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="bg-background/50 font-mono text-sm"
            />
            <Button onClick={handleCopy} variant="secondary">
              {copied ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Копировать
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Реферальный код: <Badge variant="secondary" className="ml-1 font-mono">{referralCode}</Badge>
          </p>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего рефералов
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (referralInfo?.total_referrals ?? 0)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего заработано
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${(referralInfo?.total_earned ?? 0).toLocaleString()} RUB`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Доступный баланс
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {loading ? '...' : `${(referralInfo?.available_balance ?? 0).toLocaleString()} RUB`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Можно использовать при оплате
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referrals table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ваши рефералы
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Загрузка...</p>
          ) : !referralInfo?.referrals?.length ? (
            <p className="text-center text-muted-foreground py-8">
              Пока нет рефералов. Поделитесь ссылкой, чтобы начать зарабатывать!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead className="text-right">Заказов</TableHead>
                    <TableHead className="text-right">Ваш доход</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralInfo.referrals.map((referral, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {referral.email.replace(/(.{3}).*(@.*)/, '$1***$2')}
                      </TableCell>
                      <TableCell>
                        {new Date(referral.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {referral.orders_count}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {referral.total_earned.toLocaleString()} RUB
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
