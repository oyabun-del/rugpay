'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Mail, Lock, Gift } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordHint = 'Разрешены: A-Z, a-z, 0-9 и ! @ # $ % _ - . (8-72 символа)';
  const passwordRegex = /^[A-Za-z0-9!@#$%_.-]+$/;

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
    }
    const storedRef = localStorage.getItem('referral_code');
    if (storedRef && !ref) {
      setReferralCode(storedRef);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    if (password.length > 72) {
      setError('Пароль не должен превышать 72 символа');
      return;
    }

    if (!passwordRegex.test(password)) {
      setError('Недопустимые символы в пароле. Используйте латиницу, цифры и ! @ # $ % _ - .');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, referralCode || undefined);
      localStorage.removeItem('referral_code');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <BrandLogo size={40} textClassName="text-2xl font-bold" />
        </div>
        <CardTitle className="text-2xl">Создать аккаунт</CardTitle>
        <CardDescription>
          Зарегистрируйтесь, чтобы отслеживать заказы и получать бонусы
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Эл. почта
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-input/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Пароль
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={72}
              className="bg-input/50"
            />
            <p className="text-xs text-muted-foreground">{passwordHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Подтвердите пароль
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-input/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral" className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Реферальный код (необязательно)
            </Label>
            <Input
              id="referral"
              type="text"
              placeholder="Введите реферальный код"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="bg-input/50"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание аккаунта...
              </>
            ) : (
              'Создать аккаунт'
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Войти
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>
      <Suspense fallback={<div className="w-full max-w-md h-[600px] bg-card/50 rounded-lg animate-pulse" />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
