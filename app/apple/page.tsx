'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { appleApi, type AppleRegion, type AppleVoucher } from '@/lib/api';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Apple, AlertTriangle, X, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Region warning popup
// ---------------------------------------------------------------------------

function RegionWarningPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2">Важная информация</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ваш <strong className="text-foreground">Регион активации</strong> должен
              совпадать с <strong className="text-foreground">регионом подарочной карты</strong>.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Например, карта с регионом <strong className="text-foreground">RU</strong> активируется
              только на российском Apple&nbsp;ID, карта <strong className="text-foreground">US</strong> —
              только на американском.
            </p>
          </div>
          <Button className="w-full" onClick={onClose}>
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function AppleBanner() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-border/40">
      <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 px-8 py-10 sm:py-12">
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
            Пополните Apple&nbsp;ID или оплатите покупки в App&nbsp;Store, iTunes,
            Apple&nbsp;Music и других сервисах. Код придёт на email после оплаты.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region cards
// ---------------------------------------------------------------------------

function RegionCard({
  region,
  selected,
  onClick,
}: {
  region: AppleRegion;
  selected: boolean;
  onClick: () => void;
}) {
  // Extract country code from "Apple Wallet Code | XX"
  const code = region.name.replace('Apple Wallet Code | ', '');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border p-3 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring
        ${selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/50 bg-card/60 hover:border-primary/50 hover:bg-card text-foreground'
        }`}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5">
          <Check className="h-3.5 w-3.5 text-primary" />
        </span>
      )}
      <span className="text-xl font-bold block leading-none mb-1">{code}</span>
      <span className="text-[10px] text-muted-foreground leading-none">
        {regionLabel(code)}
      </span>
    </button>
  );
}

function regionLabel(code: string): string {
  const map: Record<string, string> = {
    AE: 'ОАЭ', AT: 'Австрия', AU: 'Австралия', BE: 'Бельгия',
    BR: 'Бразилия', ES: 'Испания', FI: 'Финляндия', FR: 'Франция',
    IE: 'Ирландия', IN: 'Индия', IT: 'Италия', JP: 'Япония',
    LU: 'Люксембург', NL: 'Нидерланды', PL: 'Польша', PT: 'Португалия',
    RU: 'Россия', SA: 'Саудовская Аравия', TR: 'Турция', UK: 'Великобритания',
    US: 'США',
  };
  return map[code] ?? code;
}

// ---------------------------------------------------------------------------
// Voucher cards
// ---------------------------------------------------------------------------

function VoucherCard({
  voucher,
  selected,
  onClick,
}: {
  voucher: AppleVoucher;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border p-3 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring
        ${selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/50 bg-card/60 hover:border-primary/50 hover:bg-card text-foreground'
        }`}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5">
          <Check className="h-3.5 w-3.5 text-primary" />
        </span>
      )}
      <span className="text-base font-bold block leading-none mb-1">{voucher.name}</span>
      <span className="text-xs text-muted-foreground">
        {voucher.finalPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplePage() {
  const router = useRouter();

  const [showWarning, setShowWarning] = useState(false);
  const [regions, setRegions] = useState<AppleRegion[]>([]);
  const [vouchers, setVouchers] = useState<AppleVoucher[]>([]);

  const [email, setEmail] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState('');

  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    appleApi
      .getRegions()
      .then(({ data }) => setRegions(data.regions))
      .catch(() => setError('Не удалось загрузить список регионов'))
      .finally(() => setLoadingRegions(false));
  }, []);

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
        min_price: selectedVoucherData.minPrice,
      });
      router.push(data.payment_url);
    } catch {
      setError('Не удалось создать заказ. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {showWarning && <RegionWarningPopup onClose={() => setShowWarning(false)} />}

      <Header />

      <main className="flex-1 relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <AppleBanner />

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">

            {/* Email */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-3">
                <Label htmlFor="email" className="flex items-center gap-2 text-base font-semibold">
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
              </CardContent>
            </Card>

            {/* Regions */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                <p className="text-base font-semibold">Регион карты</p>
                {loadingRegions ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка регионов...
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2">
                    {regions.map((r) => (
                      <RegionCard
                        key={r.id}
                        region={r}
                        selected={selectedRegion === r.id}
                        onClick={() => setSelectedRegion(r.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vouchers */}
            {selectedRegion && (
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-base font-semibold">Номинал карты</p>
                  {loadingVouchers ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Загрузка номиналов...
                    </div>
                  ) : vouchers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Нет доступных номиналов
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {vouchers.map((v) => (
                        <VoucherCard
                          key={v.id}
                          voucher={v}
                          selected={selectedVoucher === v.id}
                          onClick={() => setSelectedVoucher(v.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary + submit */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                {selectedVoucherData && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Карта</span>
                      <span className="font-medium">{selectedVoucherData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Итого к оплате</span>
                      <span className="font-bold text-primary text-base">
                        {selectedVoucherData.finalPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                {/* Warning button */}
                <button
                  type="button"
                  onClick={() => setShowWarning(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/5 px-4 py-2.5 text-sm font-medium text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Внимание: регион карты и Apple&nbsp;ID должны совпадать
                </button>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || !selectedVoucher || !email || !selectedRegion}
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
              </CardContent>
            </Card>

          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
