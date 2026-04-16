'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { adminApi, authApi, type AdminOrder, type BannerSlide, type FormSettings, type User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand-logo';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Mail,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Eye,
  EyeOff,
  Settings,
  Package,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

function LoginForm({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      if (!data.user.is_admin) {
        setError('Нет прав администратора');
        return;
      }
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.access_token, data.user);
    } catch {
      setError('Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-sm border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <BrandLogo size={36} textClassName="text-xl font-bold" />
          </div>
          <CardTitle className="text-xl">Панель администратора</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-input/50"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Войти'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner slide row (view / edit)
// ---------------------------------------------------------------------------

interface SlideRowProps {
  slide: BannerSlide;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  onDelete: (id: number) => void;
  onSave: (id: number, data: Partial<BannerSlide>) => Promise<void>;
}

function SlideRow({ slide, isFirst, isLast, onMoveUp, onMoveDown, onDelete, onSave }: SlideRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: slide.title,
    image_url: slide.image_url,
    button_text: slide.button_text ?? '',
    button_link: slide.button_link ?? '',
    is_active: slide.is_active,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(slide.id, {
        title: form.title,
        image_url: form.image_url,
        button_text: form.button_text || null,
        button_link: form.button_link || null,
        is_active: form.is_active,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      title: slide.title,
      image_url: slide.image_url,
      button_text: slide.button_text ?? '',
      button_link: slide.button_link ?? '',
      is_active: slide.is_active,
    });
    setEditing(false);
  };

  return (
    <div className="border border-border/50 rounded-xl bg-card/60 overflow-hidden">
      {/* Preview row */}
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-md overflow-hidden shrink-0 bg-muted">
          <Image src={slide.image_url} alt={slide.title} fill className="object-cover" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${!slide.is_active ? 'text-muted-foreground' : ''}`}>
            {slide.title}
          </p>
          {slide.button_text && (
            <p className="text-xs text-primary truncate">{slide.button_text} → {slide.button_link}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMoveUp(slide.id)}
            disabled={isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMoveDown(slide.id)}
            disabled={isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(slide.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-border/50 p-4 space-y-3 bg-muted/20">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Заголовок</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-8 text-sm bg-input/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL картинки</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="h-8 text-sm bg-input/50"
                placeholder="/banners/example.png"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Текст кнопки</Label>
              <Input
                value={form.button_text}
                onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))}
                className="h-8 text-sm bg-input/50"
                placeholder="Пополнить Steam"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ссылка кнопки</Label>
              <Input
                value={form.button_link}
                onChange={(e) => setForm((f) => ({ ...f, button_link: e.target.value }))}
                className="h-8 text-sm bg-input/50"
                placeholder="/?game=steam#topup"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="accent-primary"
              />
              Активен
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Отмена
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Сохранить</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add slide form
// ---------------------------------------------------------------------------

function AddSlideForm({ maxOrder, onAdd }: { maxOrder: number; onAdd: (slide: BannerSlide) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    button_text: '',
    button_link: '',
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.createBannerSlide({
        title: form.title,
        image_url: form.image_url,
        button_text: form.button_text || null,
        button_link: form.button_link || null,
        is_active: form.is_active,
        sort_order: maxOrder + 1,
      });
      onAdd(data);
      setForm({ title: '', image_url: '', button_text: '', button_link: '', is_active: true });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Добавить баннер
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-primary/40 rounded-xl bg-card/60 p-4 space-y-3"
    >
      <p className="font-semibold text-sm">Новый баннер</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Заголовок *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="h-8 text-sm bg-input/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL картинки *</Label>
          <Input
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            className="h-8 text-sm bg-input/50"
            placeholder="/banners/example.png"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Текст кнопки</Label>
          <Input
            value={form.button_text}
            onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))}
            className="h-8 text-sm bg-input/50"
            placeholder="Пополнить Steam"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ссылка кнопки</Label>
          <Input
            value={form.button_link}
            onChange={(e) => setForm((f) => ({ ...f, button_link: e.target.value }))}
            className="h-8 text-sm bg-input/50"
            placeholder="/?game=steam#topup"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="accent-primary"
          />
          Активен
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Отмена
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Добавить</>}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Banners tab
// ---------------------------------------------------------------------------

function BannersTab() {
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.getBannerSlides();
      setSlides(data);
    } catch {
      setError('Не удалось загрузить баннеры');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (id: number, data: Partial<BannerSlide>) => {
    const { data: updated } = await adminApi.updateBannerSlide(id, data);
    setSlides((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот баннер?')) return;
    await adminApi.deleteBannerSlide(id);
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMoveUp = async (id: number) => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    const prev = slides[idx - 1];
    const cur = slides[idx];
    await Promise.all([
      adminApi.updateBannerSlide(prev.id, { sort_order: cur.sort_order }),
      adminApi.updateBannerSlide(cur.id, { sort_order: prev.sort_order }),
    ]);
    setSlides((arr) => {
      const next = [...arr];
      next[idx - 1] = { ...prev, sort_order: cur.sort_order };
      next[idx] = { ...cur, sort_order: prev.sort_order };
      return next.sort((a, b) => a.sort_order - b.sort_order);
    });
  };

  const handleMoveDown = async (id: number) => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx >= slides.length - 1) return;
    const next = slides[idx + 1];
    const cur = slides[idx];
    await Promise.all([
      adminApi.updateBannerSlide(next.id, { sort_order: cur.sort_order }),
      adminApi.updateBannerSlide(cur.id, { sort_order: next.sort_order }),
    ]);
    setSlides((arr) => {
      const copy = [...arr];
      copy[idx + 1] = { ...next, sort_order: cur.sort_order };
      copy[idx] = { ...cur, sort_order: next.sort_order };
      return copy.sort((a, b) => a.sort_order - b.sort_order);
    });
  };

  const visible = showInactive ? slides : slides.filter((s) => s.is_active);
  const maxOrder = slides.reduce((m, s) => Math.max(m, s.sort_order), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <p className="text-destructive text-center py-8">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{slides.length} баннер(а)</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-primary"
          />
          Показать неактивные
        </label>
      </div>

      <div className="space-y-2">
        {visible.map((slide, idx) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            isFirst={idx === 0}
            isLast={idx === visible.length - 1}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        ))}
        {visible.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Баннеры не найдены</p>
        )}
      </div>

      <AddSlideForm maxOrder={maxOrder} onAdd={(s) => setSlides((prev) => [...prev, s])} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form settings tab
// ---------------------------------------------------------------------------

const FORM_ITEMS: { key: keyof FormSettings; label: string; description: string }[] = [
  { key: 'steam_enabled', label: 'Steam', description: 'Форма пополнения Steam на главной странице' },
  { key: 'pubg_enabled', label: 'PUBG Mobile', description: 'Форма покупки PUBG Mobile UC на главной странице' },
  { key: 'apple_enabled', label: 'Apple Gift Card', description: 'Страница покупки Apple Gift Card (/apple)' },
];

function FormSettingsTab() {
  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getFormSettings()
      .then(({ data }) => setSettings(data))
      .catch(() => setError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: keyof FormSettings, value: boolean) => {
    if (!settings) return;
    setSaving(key);
    try {
      const { data } = await adminApi.updateFormSettings({ [key]: value });
      setSettings(data);
    } catch {
      setError('Не удалось обновить настройку');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error && !settings) return <p className="text-destructive text-center py-8">{error}</p>;
  if (!settings) return null;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Включите или отключите формы оплаты для пользователей. Отключённые формы не будут отображаться на сайте.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {FORM_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/60 p-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saving === item.key && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => handleToggle(item.key, checked)}
                disabled={saving !== null}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Ожидание', cls: 'bg-yellow-500/15 text-yellow-500' },
  paid: { text: 'Оплачен', cls: 'bg-blue-500/15 text-blue-500' },
  processing: { text: 'В обработке', cls: 'bg-purple-500/15 text-purple-500' },
  completed: { text: 'Выполнен', cls: 'bg-green-500/15 text-green-500' },
  failed: { text: 'Ошибка', cls: 'bg-red-500/15 text-red-500' },
  cancelled: { text: 'Отменён', cls: 'bg-muted text-muted-foreground' },
  refunded: { text: 'Возврат', cls: 'bg-orange-500/15 text-orange-500' },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  steam: 'Steam',
  pubg: 'PUBG',
  apple: 'Apple Gift Card',
};

const STATUS_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'pending', label: 'Ожидание' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'processing', label: 'В обработке' },
  { value: 'completed', label: 'Выполнен' },
  { value: 'failed', label: 'Ошибка' },
];

function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const perPage = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (statusFilter) params.status = statusFilter;
      const { data } = await adminApi.getOrders(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
      setError('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const copyCode = (code: string, orderId: number) => {
    navigator.clipboard.writeText(code);
    setCopied(orderId);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading && orders.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error && orders.length === 0) {
    return <p className="text-destructive text-center py-8">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setPage(1); setStatusFilter(f.value); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{total} заказ(ов)</span>
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {orders.map((order) => {
          const st = STATUS_LABELS[order.status] ?? { text: order.status, cls: 'bg-muted text-muted-foreground' };
          const isApple = order.order_type === 'apple';
          const expanded = expandedId === order.id;

          return (
            <div
              key={order.id}
              className="border border-border/50 rounded-xl bg-card/60 overflow-hidden"
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : order.id)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/30 shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">#{order.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {ORDER_TYPE_LABELS[order.order_type ?? 'steam'] ?? order.order_type}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                      {st.text}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.email}
                    {order.steam_nickname && ` · ${order.steam_nickname}`}
                    {order.pubg_uid && ` · UID: ${order.pubg_uid}`}
                    {isApple && order.apple_region && ` · ${order.apple_region}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{order.final_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Detail */}
              {expanded && (
                <div className="border-t border-border/50 p-4 space-y-3 bg-muted/10">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="font-medium break-all">{order.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Тип</p>
                      <p className="font-medium">{ORDER_TYPE_LABELS[order.order_type ?? 'steam']}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Сумма</p>
                      <p className="font-medium">{order.amount.toLocaleString('ru-RU')} → {order.final_amount.toLocaleString('ru-RU')} ₽</p>
                    </div>
                    {order.steam_nickname && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Steam</p>
                        <p className="font-medium">{order.steam_nickname}</p>
                      </div>
                    )}
                    {order.pubg_uid && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">PUBG UID</p>
                        <p className="font-medium">{order.pubg_uid} ({order.pubg_uc_amount} UC)</p>
                      </div>
                    )}
                    {isApple && order.apple_region && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Регион</p>
                        <p className="font-medium">{order.apple_region}</p>
                      </div>
                    )}
                  </div>

                  {/* Apple Gift Card code */}
                  {isApple && order.apple_gift_card_code && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                      <p className="text-[10px] text-green-500 uppercase tracking-wide font-medium mb-1">Код Apple Gift Card</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono font-bold text-foreground break-all">
                          {order.apple_gift_card_code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyCode(order.apple_gift_card_code!, order.id)}
                        >
                          {copied === order.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isApple && order.status === 'completed' && !order.apple_gift_card_code && (
                    <p className="text-xs text-muted-foreground italic">Код Apple не найден в ответе провайдера</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {orders.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Заказы не найдены</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [tab, setTab] = useState<'orders' | 'banners' | 'forms'>('orders');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const u: User = JSON.parse(stored);
        if (u.is_admin) {
          setUser(u);
          setAuthed(true);
        }
      } catch {
        // ignore
      }
    }
    setBootstrapping(false);
  }, []);

  const handleLogin = (token: string, u: User) => {
    setUser(u);
    setAuthed(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setAuthed(false);
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const TABS = [
    { key: 'orders' as const, label: 'Заказы' },
    { key: 'banners' as const, label: 'Баннеры' },
    { key: 'forms' as const, label: 'Формы' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size={28} textClassName="text-base font-bold" />
            <span className="text-muted-foreground text-sm hidden sm:block">/ Администратор</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border/50">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'orders' && <OrdersTab />}
        {tab === 'banners' && <BannersTab />}
        {tab === 'forms' && <FormSettingsTab />}
      </main>
    </div>
  );
}
