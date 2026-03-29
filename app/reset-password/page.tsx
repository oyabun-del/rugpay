'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { BrandLogo } from '@/components/brand-logo';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordHint = 'Разрешены: A-Z, a-z, 0-9 и ! @ # $ % _ - . (8-72 символа)';
  const passwordRegex = /^[A-Za-z0-9!@#$%_.-]+$/;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!token) {
      setError('Отсутствует токен сброса пароля');
      return;
    }
    if (newPassword.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (newPassword.length > 72) {
      setError('Пароль не должен превышать 72 символа');
      return;
    }
    if (!passwordRegex.test(newPassword)) {
      setError('Недопустимые символы в пароле. Используйте латиницу, цифры и ! @ # $ % _ - .');
      return;
    }
    if (newPassword !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, new_password: newPassword });
      setMessage('Пароль успешно обновлен. Сейчас вы будете перенаправлены на вход.');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : 'Не удалось изменить пароль';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo size={40} textClassName="text-2xl font-bold" />
          </div>
          <CardTitle className="text-2xl">Новый пароль</CardTitle>
          <CardDescription>Введите новый пароль для аккаунта.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Новый пароль
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                required
                maxLength={72}
                className="bg-input/50"
              />
              <p className="text-xs text-muted-foreground">{passwordHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Повторите пароль
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="bg-input/50"
              />
            </div>

            {message && <p className="text-sm text-green-500 text-center">{message}</p>}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить пароль'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">Вернуться ко входу</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
