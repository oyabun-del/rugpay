'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { appleApi, isTrustedPaymentUrl, type AppleRegion, type AppleVoucher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, AlertTriangle, X, Check, ChevronDown, Tag, Smartphone, LogIn, Gift, CreditCard } from 'lucide-react';
import Image from 'next/image';

const PRIORITY_REGIONS = ['RU', 'US', 'TR'];

/** Strip verbose Apple product prefixes from voucher names, e.g. "App Store & iTunes Code 150 TL" → "150 TL" */
function cleanVoucherName(raw: string): string {
  return raw
    .replace(/App Store\s*&\s*iTunes\s*(Code\s*)?/i, '')
    .replace(/Apple\s*(Wallet\s*)?(Code\s*)?/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Region warning popup
// ---------------------------------------------------------------------------

function RegionWarningPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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
    <div className="relative w-full overflow-hidden rounded-2xl border border-primary/20"
      style={{ background: 'linear-gradient(135deg, oklch(0.10 0.03 270) 0%, oklch(0.14 0.06 270) 50%, oklch(0.11 0.04 270) 100%)' }}
    >
      {/* Spotlight-style glows */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(198,40,46,0.35) 0%, transparent 70%)', filter: 'blur(48px)' }}
      />
      <div className="absolute -bottom-16 right-10 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.22 270 / 0.3) 0%, transparent 70%)', filter: 'blur(48px)' }}
      />
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(198,40,46,0.15) 0%, transparent 70%)', filter: 'blur(32px)' }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 px-8 py-10 sm:py-12">
        {/* Apple logo */}
        <div className="shrink-0 flex items-center justify-center w-24 h-24 rounded-2xl"
          style={{ background: 'oklch(0.18 0.04 270 / 0.6)', backdropFilter: 'blur(8px)', border: '1px solid oklch(0.62 0.22 270 / 0.2)' }}
        >
          <Image
            src="/apple-logo.png"
            alt="Apple"
            width={52}
            height={52}
            className="object-contain drop-shadow-lg"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Подарочные карты
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Apple Gift Card
          </h1>
          <p className="text-sm max-w-md" style={{ color: 'oklch(0.80 0.02 270)' }}>
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

function regionLabel(code: string): string {
  const map: Record<string, string> = {
    AE: 'ОАЭ', AT: 'Австрия', AU: 'Австралия', BE: 'Бельгия',
    BR: 'Бразилия', ES: 'Испания', FI: 'Финляндия', FR: 'Франция',
    IE: 'Ирландия', IN: 'Индия', IT: 'Италия', JP: 'Япония',
    LU: 'Люксем.', NL: 'Нидерл.', PL: 'Польша', PT: 'Португалия',
    RU: 'Россия', SA: 'Саудовская Ар.', TR: 'Турция', UK: 'Великобр.',
    US: 'США',
  };
  return map[code] ?? code;
}

function RegionCard({
  region,
  selected,
  onClick,
}: {
  region: AppleRegion;
  selected: boolean;
  onClick: () => void;
}) {
  const code = region.name.replace('Apple Wallet Code | ', '');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border px-3 py-3 text-center transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0
        ${selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/50 bg-card/60 hover:border-primary/50 hover:bg-card text-foreground'
        }`}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5">
          <Check className="h-3 w-3 text-primary" />
        </span>
      )}
      <span className="text-lg font-bold block leading-none mb-1">{code}</span>
      <span className="text-[10px] text-muted-foreground leading-tight block break-words">
        {regionLabel(code)}
      </span>
    </button>
  );
}

function RegionGrid({ regions, selected, onSelect }: {
  regions: AppleRegion[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandRef = useRef<HTMLDivElement>(null);
  const [expandHeight, setExpandHeight] = useState(0);

  const priority = regions.filter(r => {
    const code = r.name.replace('Apple Wallet Code | ', '');
    return PRIORITY_REGIONS.includes(code);
  });
  const rest = regions.filter(r => {
    const code = r.name.replace('Apple Wallet Code | ', '');
    return !PRIORITY_REGIONS.includes(code);
  });

  useEffect(() => {
    if (expandRef.current) {
      setExpandHeight(expandRef.current.scrollHeight);
    }
  }, [rest.length]);

  return (
    <div className="space-y-3">
      {/* Priority regions always visible */}
      <div className="grid grid-cols-3 gap-2">
        {priority.map(r => (
          <RegionCard key={r.id} region={r} selected={selected === r.id} onClick={() => onSelect(r.id)} />
        ))}
      </div>

      {/* Collapsible rest */}
      {rest.length > 0 && (
        <>
          <div
            ref={expandRef}
            style={{ maxHeight: expanded ? expandHeight : 0 }}
            className="overflow-hidden transition-all duration-400 ease-in-out"
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1">
              {rest.map(r => (
                <RegionCard key={r.id} region={r} selected={selected === r.id} onClick={() => onSelect(r.id)} />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Свернуть' : `Показать весь список (ещё ${rest.length})`}
          </button>
        </>
      )}
    </div>
  );
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
      className={`relative rounded-xl border px-3 py-3 text-center transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/50 bg-card/60 hover:border-primary/50 hover:bg-card text-foreground'
        }`}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5">
          <Check className="h-3 w-3 text-primary" />
        </span>
      )}
      <span className="text-sm font-bold block leading-none">{cleanVoucherName(voucher.name)}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplePage() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [showWarning, setShowWarning] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
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
    appleApi.getConfig().then(({ data }) => setDiscountPercent(data.discount_percent)).catch(() => {});
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

  // Extract region code from selected region
  const selectedRegionData = regions.find((r) => r.id === selectedRegion);
  const regionCode = selectedRegionData
    ? selectedRegionData.name.replace('Apple Wallet Code | ', '')
    : '';

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
        region: regionCode,
      });
      // Set guest session if returned
      if (data.guest_access_token && data.guest_user) {
        await setSession(data.guest_access_token, data.guest_user);
      }
      // Redirect directly to Wata DG payment page (not /payment/{orderId})
      if (data.payment_url && isTrustedPaymentUrl(data.payment_url)) {
        window.location.href = data.payment_url;
      } else {
        router.push(`/payment/${data.order.id}`);
      }
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
                  <RegionGrid
                    regions={regions}
                    selected={selectedRegion}
                    onSelect={setSelectedRegion}
                  />
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

            {/* Activation instructions */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                <p className="text-base font-semibold">Как активировать Apple Gift Card</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Smartphone, step: '1', title: 'Откройте App Store', desc: 'На iPhone, iPad или Mac откройте приложение App Store' },
                    { icon: LogIn, step: '2', title: 'Войдите в аккаунт', desc: 'Убедитесь, что регион Apple ID совпадает с регионом карты' },
                    { icon: CreditCard, step: '3', title: 'Погасить код', desc: 'Нажмите «Погасить подарочную карту или код» и введите код' },
                    { icon: Gift, step: '4', title: 'Готово!', desc: 'Средства зачислены на баланс Apple ID. Покупайте приложения, игры и подписки' },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Summary + submit */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6 space-y-4">
                {selectedVoucherData && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 px-5 py-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Карта</span>
                      <span className="font-medium">{cleanVoucherName(selectedVoucherData.name)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Регион</span>
                      <span className="font-medium">{regionCode}</span>
                    </div>
                    {discountPercent > 0 && selectedVoucherData.discountedPrice < selectedVoucherData.finalPrice && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Скидка
                          <span className="text-green-500 font-medium">-{discountPercent}%</span>
                        </span>
                        <span className="line-through text-muted-foreground">
                          {selectedVoucherData.finalPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-3 flex justify-between items-center">
                      <span className="font-semibold">Итого к оплате</span>
                      <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-primary to-primary/80 px-4 py-1.5 text-primary-foreground font-extrabold text-xl tracking-tight shadow-lg shadow-primary/25">
                        {selectedVoucherData.discountedPrice.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                      </span>
                    </div>
                  </div>
                )}

                {/* Discount banner */}
                {discountPercent > 0 && (
                  <div className="relative overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 px-5 py-4 flex items-center gap-4">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.15),transparent_70%)] pointer-events-none" />
                    <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-primary/20 border border-primary/40">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary/80 font-medium uppercase tracking-wide">Специальное предложение</p>
                      <p className="text-lg font-bold text-foreground leading-tight">
                        Скидка <span className="text-primary">{discountPercent}%</span> на все карты Apple
                      </p>
                    </div>
                    <div className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground font-bold text-sm shadow">
                      -{discountPercent}%
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

                <p className="text-[10px] text-muted-foreground text-center leading-tight">
                  Нажимая &laquo;Перейти к оплате&raquo;, вы принимаете{' '}
                  <a href="/privacy" className="underline hover:text-foreground transition-colors">Политику конфиденциальности</a>{' '}
                  и{' '}
                  <a href="/terms" className="underline hover:text-foreground transition-colors">Публичную оферту</a>.
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
