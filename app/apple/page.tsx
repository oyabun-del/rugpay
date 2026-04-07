'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { appleApi, type AppleRegion, type AppleVoucher } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Globe, CreditCard, Apple } from 'lucide-react';

// ---------------------------------------------------------------------------
// Page banner
// ---------------------------------------------------------------------------

function AppleBanner() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-border/40">
      {/* decorative glows */}
      <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 px-8 py-10 sm:py-14">
        {/* Apple icon */}
        <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
          <Apple className="w-10 h-10 text-white" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Подарочные карты
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Apple Gift Card
          </h1>
          <p className="text-sm text-zinc-400 max-w-md">
            Пополните Apple&nbsp;ID или оплатите покупки в&nbsp;App&nbsp;Store, iTunes, Apple Music
            и&nbsp;других сервисах Apple. Код придёт на&nbsp;email после оплаты.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order form
// ---------------------------------------------------------------------------

export default function ApplePage() {
  const router = useRouter();

  const [regions, setRegions] = useState<AppleRegion[]>([]);
  const [vouchers, setVouchers] = useState<AppleVoucher[]>([]);

  const [email, setEmail] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState('');

  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load regions once
  useEffect(() => {
    appleApi
      .getRegions()
      .then(({ data }) => setRegions(data.regions))
      .catch(() => setError('Не удалось загрузить список регионов'))
      .finally(() => setLoadingRegions(false));
  }, []);

  // Load denominations when region changes
  useEffect(() => {
    if (!selectedRegion) {
      setVouchers([]);
      setSelectedVoucher('');
      return;
    }
    setLoadingVouchers(true);
    setVouchers([]);
    setSelectedVoucher('');
    appleApi
      .getDenominations(selectedRegion)
      .then(({ data }) => setVouchers(data.vouchers))
      .catch(() => setError('Не удалось загрузить суммы для выбранного региона'))
      .finally(() => setLoadingVouchers(false));
  }, [selectedRegion]);

  const selectedVoucherData = vouchers.find((v) => v.id === selectedVoucher);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoucherData) return;
    setError('');
    setSubmitting(true);
    try {
      const { data } = await appleApi.createOrder({
        email,
        voucher_id: selectedVoucherData.id,
        amount: selectedVoucherData.minPrice,
      });
      router.push(data.payment_url);
    } catch {
      setError('Не удалось создать заказ. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Banner */}
        <AppleBanner />

        {/* Form */}
        <Card className="mt-8 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email для получения кода
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

              {/* Region */}
              <div className="space-y-2">
                <Label htmlFor="region" className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Регион карты
                </Label>
                {loadingRegions ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка регионов...
                  </div>
                ) : (
                  <select
                    id="region"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-input bg-input/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Выберите регион</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name.replace('Apple Wallet Code | ', '')}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Denomination */}
              <div className="space-y-2">
                <Label htmlFor="voucher" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Номинал карты
                </Label>
                {loadingVouchers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка номиналов...
                  </div>
                ) : (
                  <select
                    id="voucher"
                    value={selectedVoucher}
                    onChange={(e) => setSelectedVoucher(e.target.value)}
                    required
                    disabled={!selectedRegion || vouchers.length === 0}
                    className="w-full h-10 rounded-md border border-input bg-input/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!selectedRegion
                        ? 'Сначала выберите регион'
                        : vouchers.length === 0
                        ? 'Нет доступных номиналов'
                        : 'Выберите номинал'}
                    </option>
                    {vouchers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.minPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Price summary */}
              {selectedVoucherData && (
                <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Карта</span>
                    <span className="font-medium">{selectedVoucherData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Итого к оплате</span>
                    <span className="font-bold text-primary text-base">
                      {selectedVoucherData.minPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting || !selectedVoucher || !email}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Создание заказа...
                  </>
                ) : (
                  'Перейти к оплате'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Код подарочной карты будет отправлен на указанный email после успешной оплаты
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
