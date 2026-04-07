'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react';

export default function AppleSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 relative z-10 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-6 text-center space-y-5">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold mb-2">Оплата прошла успешно!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Код подарочной карты Apple будет отправлен на указанный вами email
                в течение нескольких минут.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Проверьте почту, включая папку «Спам»</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button asChild>
                <Link href="/apple">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Купить ещё одну карту
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/">
                  На главную
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
