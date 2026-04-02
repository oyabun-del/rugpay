'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Wallet, User, Ticket, CheckCircle2, CircleAlert, Gift } from 'lucide-react';
import { ordersApi, pubgApi, type PubgPackage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

const PUBG_PRICE_REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_PUBG_PACKAGES: PubgPackage[] = [];
type FormMode = 'steam' | 'pubg';

const DEFAULT_PRICING_CONFIG = {
  commission_threshold_amount: 1000,
  commission_percent_up_to_threshold: 11,
  commission_percent_above_threshold: 10,
  steam_discount_percent: 0,
  pubg_discount_percent: 0,
};

export function TopupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const [formMode, setFormMode] = useState<FormMode>('steam');
  const cardRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  const [steamNickname, setSteamNickname] = useState('');
  const [amount, setAmount] = useState('');
  const [pubgUid, setPubgUid] = useState('');
  const [pubgPackages, setPubgPackages] = useState<PubgPackage[]>(DEFAULT_PUBG_PACKAGES);
  const [selectedPubgUc, setSelectedPubgUc] = useState<number | null>(null);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);

  const [promocode, setPromocode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flash = () => {
      setHighlight(false);
      // Force reflow so re-adding the class restarts the animation
      void cardRef.current?.offsetWidth;
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2200);
    };

    // Flash on initial load if hash is #topup
    if (window.location.hash === '#topup') {
      flash();
    }

    // Listen for clicks on any anchor pointing to #topup
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href*="#topup"]');
      if (target) {
        setTimeout(flash, 300);
      }
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#topup') flash();
    });

    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
    }
  }, [searchParams]);

  useEffect(() => {
    const game = (searchParams.get('game') || '').toLowerCase();
    if (game === 'steam' || game === 'pubg') {
      setFormMode(game);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadPricingConfig = async () => {
      try {
        const { data } = await ordersApi.getPricingConfig();
        setPricingConfig(data);
      } catch {
        // Keep defaults if pricing config endpoint is temporarily unavailable.
      }
    };
    void loadPricingConfig();
  }, []);

  useEffect(() => {
    const loadPubgPackages = async () => {
      try {
        const { data } = await pubgApi.getPackages();
        const normalized = Array.isArray(data.packages)
          ? data.packages.map((pkg) => ({
              ...pkg,
              image_url: pkg.image_url || '/pubg-mobile-logo.png',
            }))
          : [];
        setPubgPackages(normalized);
        const firstEnabled = normalized.find((pkg) => pkg.enabled);
        setSelectedPubgUc(firstEnabled ? firstEnabled.uc : null);
      } catch {
        // Preserve current prices to avoid visible resets/flicker on transient backend issues.
      }
    };

    loadPubgPackages();
    const interval = setInterval(() => {
      void loadPubgPackages();
    }, PUBG_PRICE_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const commissionPercentLabel =
    numAmount <= pricingConfig.commission_threshold_amount
      ? pricingConfig.commission_percent_up_to_threshold
      : pricingConfig.commission_percent_above_threshold;
  const commissionRate = commissionPercentLabel / 100;
  const commission = numAmount * commissionRate * (1 - promoDiscount);
  const finalAmount = numAmount + commission;
  const steamDiscountPercent = Math.max(pricingConfig.steam_discount_percent, 0);
  const pubgDiscountPercent = Math.max(pricingConfig.pubg_discount_percent, 0);
  const steamDiscountMultiplier = 1 - steamDiscountPercent / 100;
  const pubgDiscountMultiplier = 1 - pubgDiscountPercent / 100;
  const steamLoginRegex = /^[A-Za-z0-9]{2,32}$/;
  const pubgUidRegex = /^\d{5,20}$/;
  const extractApiErrorMessage = (err: unknown, fallback: string): string => {
    if (
      err &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { data?: { detail?: unknown } } }).response?.data
    ) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | undefined;
        if (first?.msg) {
          return first.msg;
        }
      }
    }
    return fallback;
  };
  const emphasizedInputClass =
    'bg-background/90 border-2 border-primary/35 font-semibold placeholder:font-medium placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';

  const handleApplyPromo = async () => {
    if (!promocode.trim()) return;
    
    try {
      // Mock promo validation - replace with actual API call
      if (promocode.toLowerCase() === 'steam10') {
        setPromoApplied(true);
        setPromoDiscount(0.1); // 10% off commission
        toast({
          title: 'Промокод применен',
          description: 'Скидка на комиссию успешно активирована.',
          duration: 3000,
        });
      } else {
        setPromoApplied(false);
        setPromoDiscount(0);
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Промокод недействителен',
          duration: 3500,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось применить промокод',
        duration: 3500,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formMode === 'pubg') {
      const uid = pubgUid.trim();
      if (!uid || !pubgUidRegex.test(uid)) {
        toast({
          variant: 'destructive',
          title: 'Ошибка формы',
          description: 'Введите корректный PUBG UID (только цифры)',
          duration: 3500,
        });
        return;
      }
      if (!selectedPubgUc) {
        toast({
          variant: 'destructive',
          title: 'Ошибка формы',
          description: 'Выберите гифт-пакет UC',
          duration: 3500,
        });
        return;
      }

      setIsLoading(true);
      try {
        const referralCode = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null;
        const payload = {
          uid,
          uc_amount: selectedPubgUc,
          promocode: promocode.trim() || undefined,
          referral_code: referralCode || undefined,
        };

        const { data } =
          typeof window !== 'undefined' && localStorage.getItem('token')
            ? await pubgApi.createOrderAuth(payload)
            : await pubgApi.createOrder(payload);

        if (data.guest_access_token) {
          await setSession(data.guest_access_token, data.guest_user ?? null);
        }

        if (data.payment_url) {
          window.location.href = data.payment_url;
          return;
        }
        router.push(`/payment/${data.order.id}`);
      } catch (err: unknown) {
        const msg = extractApiErrorMessage(
          err,
          'Не удалось создать PUBG заказ. Попробуйте еще раз.',
        );
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: msg,
          duration: 4000,
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const steamLogin = steamNickname.trim();
    if (!steamLogin) {
      toast({
        variant: 'destructive',
        title: 'Ошибка формы',
        description: 'Введите Логин Steam',
        duration: 3500,
      });
      return;
    }
    if (!steamLoginRegex.test(steamLogin)) {
      toast({
        variant: 'destructive',
        title: 'Ошибка формы',
        description: 'Логин Steam: только английские буквы и цифры, 2-32 символа, без пунктуации',
        duration: 4000,
      });
      return;
    }

    if (numAmount < 100) {
      toast({
        variant: 'destructive',
        title: 'Ошибка формы',
        description: 'Минимальная сумма пополнения — 100 RUB',
        duration: 3500,
      });
      return;
    }

    setIsLoading(true);

    try {
      const referralCode = typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null;
      const payload = {
        steam_nickname: steamLogin,
        steam_profile_url: undefined,
        amount: numAmount,
        promocode: promocode.trim() || undefined,
        referral_code: referralCode || undefined,
      };

      const { data } =
        typeof window !== 'undefined' && localStorage.getItem('token')
          ? await ordersApi.createAuth(payload)
          : await ordersApi.create(payload);

      if (data.guest_access_token) {
        await setSession(data.guest_access_token, data.guest_user ?? null);
      }

      if (data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      router.push(`/payment/${data.order.id}`);
    } catch (err: unknown) {
      const msg = extractApiErrorMessage(err, 'Не удалось создать заказ. Попробуйте еще раз.');
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: msg,
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card ref={cardRef} className={`w-full max-w-[31rem] h-auto lg:min-h-[620px] border-border/50 bg-card/80 shadow-lg backdrop-blur-sm rounded-2xl ${highlight ? 'animate-form-highlight' : ''}`}>
      <CardHeader className="space-y-1">
        <div className="grid grid-cols-2 gap-2 pb-2">
          <Button
            type="button"
            variant={formMode === 'steam' ? 'default' : 'outline'}
            onClick={() => setFormMode('steam')}
            className="w-full justify-center gap-2"
          >
            <Image
              src="/steam-logo.png"
              alt="Steam"
              width={18}
              height={18}
              className="h-4.5 w-4.5 rounded-sm object-cover"
            />
            <span>Steam</span>
          </Button>
          <Button
            type="button"
            variant={formMode === 'pubg' ? 'default' : 'outline'}
            onClick={() => setFormMode('pubg')}
            className="w-full justify-center gap-2"
          >
            <Image
              src="/pubg-mobile-logo.png"
              alt="PUBG Mobile"
              width={18}
              height={18}
              className="h-4.5 w-4.5 rounded-sm object-cover"
            />
            <span>PUBG Mobile</span>
          </Button>
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          {formMode === 'steam' ? 'Пополнение Steam' : 'PUBG Mobile UC'}
        </CardTitle>
        <CardDescription className="text-center">
          {formMode === 'steam'
            ? 'Введите данные для пополнения баланса Steam'
            : 'Введите UID и выберите пакет UC'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={formMode === 'steam' ? 'space-y-4' : 'min-h-[300px] space-y-4'}>
            {formMode === 'steam' ? (
              <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="steam" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Логин Steam
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <CircleAlert className="h-3.5 w-3.5 mr-1 text-yellow-500" />
                        Памятка
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      <p className="text-sm font-semibold text-yellow-500">Обратите внимание!</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Логин это то, что вы указываете при входе в Steam. Если вы укажете неверный
                        логин, то средства уйдут другому пользователю.
                      </p>
                      <div className="overflow-hidden rounded-md border border-border/60">
                        <Image
                          src="/steam-login-hint.png"
                          alt="Пример расположения Steam логина"
                          width={258}
                          height={62}
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="steam"
                  placeholder="Логин Steam"
                  value={steamNickname}
                  onChange={(e) => setSteamNickname(e.target.value)}
                  maxLength={32}
                  className={emphasizedInputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Допустимо: английские буквы и цифры, без пунктуации (2-32 символа).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Сумма пополнения (RUB)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Введите сумму"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="100"
                  className={emphasizedInputClass}
                />
              </div>
              </>
            ) : (
              <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pubg_uid" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    UID
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <CircleAlert className="h-3.5 w-3.5 mr-1 text-yellow-500" />
                        Памятка
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      <p className="text-sm font-semibold text-yellow-500">Где взять UID?</p>
                      <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                        <p>1) Войди в свой аккаунт в PUBG Mobile.</p>
                        <p>2) Нажми на свой аватар в левом верхнем углу экрана.</p>
                        <p>3) В профиле над аватаркой будет твой UID.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="pubg_uid"
                  placeholder="Введите UID PUBG Mobile"
                  value={pubgUid}
                  onChange={(e) => setPubgUid(e.target.value.replace(/\D/g, ''))}
                  maxLength={20}
                  className={emphasizedInputClass}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  Выбор гифта (UC)
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pubgPackages.map((pkg) => (
                    <button
                      key={pkg.uc}
                      type="button"
                      onClick={() => pkg.enabled && setSelectedPubgUc(pkg.uc)}
                      disabled={!pkg.enabled}
                      className={`relative min-h-[96px] rounded-lg border p-3.5 pr-10 text-left transition ${
                        selectedPubgUc === pkg.uc
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background/40'
                      } ${pkg.enabled ? 'hover:border-primary/60' : 'opacity-50 cursor-not-allowed'}`}
                    >
                      {selectedPubgUc === pkg.uc && pkg.enabled && (
                        <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" />
                      )}
                      <div className="flex items-center gap-3">
                        <Image
                          src={pkg.image_url || '/pubg-mobile-logo.png'}
                          alt={pkg.label}
                          width={56}
                          height={56}
                          className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xl font-extrabold leading-tight"
                            style={{ color: '#FFD700', textShadow: '0 1px 6px rgba(255,215,0,0.35)' }}>
                            {pkg.uc} UC
                          </span>
                          {pkg.price_rub ? (
                            <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                              <span className="text-sm text-primary font-semibold">
                                {Math.round(pkg.price_rub * pubgDiscountMultiplier)} ₽
                              </span>
                              <span className="text-xs text-muted-foreground line-through">
                                {pkg.price_rub} ₽
                              </span>
                            </div>
                          ) : pkg.enabled ? (
                            <span className="text-xs text-muted-foreground">Цена обновляется...</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Скоро</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {pubgPackages.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Нет доступных пакетов PUBG. Укажите `FAZERCARDS_PUBG_PRODUCT_ID_*` в `.env`.
                  </p>
                )}
              </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promocode" className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Промокод (необязательно)
            </Label>
            <div className="flex gap-2">
              <Input
                id="promocode"
                placeholder="Введите код"
                value={promocode}
                onChange={(e) => {
                  setPromocode(e.target.value);
                  setPromoApplied(false);
                  setPromoDiscount(0);
                }}
                className={emphasizedInputClass}
                disabled={promoApplied}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleApplyPromo}
                disabled={promoApplied || !promocode.trim()}
              >
                {promoApplied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  'Применить'
                )}
              </Button>
            </div>
            {promoApplied && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                Промокод применен
              </Badge>
            )}
          </div>

          {formMode === 'steam' && numAmount > 0 && (
            <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Сумма пополнения</span>
                <span>{numAmount.toFixed(2)} RUB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Скидка
                  {steamDiscountPercent > 0 && (
                    <span className="text-green-500 font-medium">-{steamDiscountPercent}%</span>
                  )}
                </span>
                <span className="text-green-500">-{(finalAmount * (steamDiscountPercent / 100)).toFixed(2)} RUB</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Итого</span>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground line-through font-normal">
                    {finalAmount.toFixed(2)} RUB
                  </span>
                  <span className="text-primary text-lg">{(finalAmount * steamDiscountMultiplier).toFixed(2)} RUB</span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading || (formMode === 'steam' ? numAmount < 100 : !selectedPubgUc)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {formMode === 'steam' ? 'Создание заказа...' : 'Оформление PUBG заказа...'}
              </>
            ) : (
              formMode === 'steam' ? 'Перейти к оплате' : 'Купить PUBG Gift'
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center leading-tight mt-2">
            Нажимая &laquo;{formMode === 'steam' ? 'Перейти к оплате' : 'Купить PUBG Gift'}&raquo;, вы принимаете{' '}
            <a href="/privacy" className="underline hover:text-foreground transition-colors">Политику конфиденциальности</a>{' '}
            и{' '}
            <a href="/terms" className="underline hover:text-foreground transition-colors">Публичную оферту</a>.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
