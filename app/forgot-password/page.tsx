'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { BrandLogo } from '@/components/brand-logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setMessage('Если аккаунт существует, ссылка для сброса отправлена на email.');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : 'Не удалось отправить письмо. Попробуйте позже.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md animate-glass-appear">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo size={40} textClassName="text-2xl font-bold" />
          </div>
          <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
          <CardDescription>Введите email, и мы отправим ссылку для сброса пароля.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Эл. почта
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {message && <p className="text-sm text-green-500 text-center">{message}</p>}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                'Отправить ссылку'
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
