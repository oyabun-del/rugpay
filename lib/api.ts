import axios from 'axios';

const TRUSTED_PAYMENT_DOMAINS = [
  'wata.pro',
  'pay.wata.pro',
  'dg-api.wata.pro',
  'rugpay.ru',
  'yoomoney.ru',
  'yookassa.ru',
];

/** Validate that a payment URL points to a trusted domain. */
export function isTrustedPaymentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_PAYMENT_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const GUEST_EMAIL_SUFFIX = '@guest.gamecover.local';

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        const isGuest = storedUser
          ? (() => {
              try {
                return JSON.parse(storedUser)?.email?.endsWith(GUEST_EMAIL_SUFFIX) ?? false;
              } catch {
                return false;
              }
            })()
          : false;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Guest sessions expire silently — redirect home, not to login page
        window.location.href = isGuest ? '/' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: number;
  email: string;
  referral_code: string;
  referral_balance: number;
  is_admin: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  order_type?: 'steam' | 'pubg' | 'apple';
  steam_nickname?: string;
  pubg_uid?: string;
  pubg_uc_amount?: number;
  apple_region?: string;
  amount: number;
  commission: number;
  final_amount: number;
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'failed';
  created_at: string;
  email?: string;
}

export interface AdminOrder extends Order {
  apple_gift_card_code?: string | null;
  steam_response?: string | null;
}

export type PromocodeDiscountType = 'percentage' | 'fixed' | 'commission';

export interface Promocode {
  id: number;
  code: string;
  discount_type: PromocodeDiscountType;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ReferralInfo {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  total_earned: number;
  available_balance: number;
  referrals: Array<{
    email: string;
    created_at: string;
    orders_count: number;
    total_earned: number;
  }>;
}

export interface Stats {
  total_orders: number;
  total_users: number;
  average_processing_time: number;
  success_rate: number;
}

export interface DashboardStats {
  total_topups: number;
  total_spent: number;
  referral_earnings: number;
  recent_orders: Order[];
}

export type PaymentProvider = 'wata' | 'yookassa';

export interface PaymentProviderInfo {
  id: PaymentProvider;
  name: string;
  enabled: boolean;
}

export interface PaymentProvidersResponse {
  providers: PaymentProviderInfo[];
  default_provider: PaymentProvider | null;
}

export interface OrderPricingConfig {
  commission_threshold_amount: number;
  commission_percent_up_to_threshold: number;
  commission_percent_above_threshold: number;
  steam_discount_percent: number;
  pubg_discount_percent: number;
}

export interface OrderCalculation {
  amount: number;
  commission: number;
  commission_percent: number;
  form_discount_percent: number;
  discount_amount: number;
  referral_discount: number;
  final_amount: number;
}

export interface PubgPackage {
  uc: number;
  label: string;
  image_url: string;
  enabled: boolean;
  price_rub?: number | null;
  real_price?: number | null;
  source_currency?: string | null;
}

export interface PubgPackagesResponse {
  packages: PubgPackage[];
}

export interface CreatePubgOrderResponse {
  order: Order;
  payment_url: string;
  payment_provider: PaymentProvider;
  guest_access_token?: string;
  guest_expires_at?: string;
  guest_user?: User;
}

export interface BannerSlide {
  id: number;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  button_text?: string | null;
  button_link?: string | null;
}

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; referral_code?: string }) =>
    api.post<{ access_token: string; user: User }>('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; user: User }>('/auth/login', data),
  
  me: () => api.get<User>('/auth/me'),

  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/auth/forgot-password', data),

  resetPassword: (data: { token: string; new_password: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data),
};

// Orders API
export const ordersApi = {
  create: (data: {
    steam_nickname: string;
    steam_profile_url?: string;
    amount: number;
    email?: string;
    promocode?: string;
    use_referral_balance?: boolean;
    referral_code?: string;
    payment_provider?: PaymentProvider;
  }) => api.post<{
    order: Order;
    payment_url: string;
    payment_provider: PaymentProvider;
    guest_access_token?: string;
    guest_expires_at?: string;
    guest_user?: User;
  }>('/orders/create', data),

  createAuth: (data: {
    steam_nickname: string;
    steam_profile_url?: string;
    amount: number;
    email?: string;
    promocode?: string;
    use_referral_balance?: boolean;
    referral_code?: string;
    payment_provider?: PaymentProvider;
  }) => api.post<{
    order: Order;
    payment_url: string;
    payment_provider: PaymentProvider;
    guest_access_token?: string;
    guest_expires_at?: string;
    guest_user?: User;
  }>('/orders/create/auth', data),

  getMy: () => api.get<{ orders: Order[]; total: number; page: number; per_page: number }>('/orders/my'),

  getById: (id: number) => api.get<Order>(`/orders/${id}`),

  calculate: (params: { amount: number; order_type?: 'steam' | 'pubg'; promocode?: string }) =>
    api.post<OrderCalculation>('/orders/calculate', null, { params }),

  getPricingConfig: () => api.get<OrderPricingConfig>('/orders/pricing-config'),

  getPaymentProviders: () => api.get<PaymentProvidersResponse>('/orders/payment-providers'),

  validatePromocode: (code: string, amount: number = 0) =>
    api.post<{
      valid: boolean;
      discount_type?: PromocodeDiscountType;
      discount_value?: number;
      discount_amount?: number;
      message?: string;
    }>('/promocode/apply', { code, amount }),
};

// Payment page: public order info (no auth)
export interface PaymentOrderInfo {
  id: number;
  order_type?: string;
  status: string;
  amount: number;
  final_amount: number;
  steam_nickname?: string;
  pubg_uid?: string;
  pubg_uc_amount?: number;
  email: string;
}

export interface PaymentLinkInfo {
  order_id: number;
  payment_url: string;
  payment_provider: PaymentProvider;
}

export const paymentsApi = {
  getOrderForPage: (orderId: number) =>
    api.get<PaymentOrderInfo>(`/payments/order/${orderId}`),
  getPayLink: (orderId: number) =>
    api.get<PaymentLinkInfo>(`/payments/order/${orderId}/pay-link`),
};

export const pubgApi = {
  getPackages: () => api.get<PubgPackagesResponse>('/pubg/packages'),

  createOrder: (data: {
    uid: string;
    uc_amount: number;
    promocode?: string;
    use_referral_balance?: boolean;
    referral_code?: string;
    payment_provider?: PaymentProvider;
  }) => api.post<CreatePubgOrderResponse>('/pubg/create', data),

  createOrderAuth: (data: {
    uid: string;
    uc_amount: number;
    promocode?: string;
    use_referral_balance?: boolean;
    referral_code?: string;
    payment_provider?: PaymentProvider;
  }) => api.post<CreatePubgOrderResponse>('/pubg/create/auth', data),
};

export interface FormSettings {
  steam_enabled: boolean;
  pubg_enabled: boolean;
  apple_enabled: boolean;
}

export const bannerApi = {
  getSlides: () => api.get<BannerSlide[]>('/banner/slides'),
};

export const settingsApi = {
  getFormSettings: () => api.get<FormSettings>('/settings/forms'),
};

// Apple Gift Card API
export interface AppleRegion {
  id: string;
  name: string;
}

export interface AppleVoucher {
  id: string;
  name: string;
  price: number;
  minPrice: number;
  finalPrice: number;
  discountedPrice: number;
  stock: number;
}

export interface AppleConfig {
  discount_percent: number;
  commission_percent: number;
}

export interface AppleRegionsResponse {
  regions: AppleRegion[];
}

export interface AppleVouchersResponse {
  vouchers: AppleVoucher[];
  details: { categoryId: string; categoryName: string };
}

export interface AppleOrderResponse {
  order: Order;
  payment_url: string;
  payment_provider: PaymentProvider;
  guest_access_token?: string;
  guest_expires_at?: string;
  guest_user?: User;
}

export const appleApi = {
  getConfig: () => api.get<AppleConfig>('/apple/config'),
  getRegions: () => api.get<AppleRegionsResponse>('/apple/regions'),
  getDenominations: (serviceId: string) =>
    api.get<AppleVouchersResponse>(`/apple/denominations/${serviceId}`),
  createOrder: (data: {
    email: string;
    voucher_id: string;
    min_price: number;
    region?: string;
    promocode?: string;
  }) => api.post<AppleOrderResponse>('/apple/create', data),
};

// Promocodes API
export const promocodesApi = {
  apply: (code: string) =>
    api.post<{ valid: boolean; discount_type: string; discount_value: number }>('/promocode/apply', { code }),
};

// Referrals API
export const referralsApi = {
  getInfo: () => api.get<ReferralInfo>('/referral/info'),
};

// Stats API (public)
export const statsApi = {
  getPublic: () => api.get<Stats>('/stats/public'),
};

// Admin API
export const adminApi = {
  getOrders: (params?: { status?: string; page?: number; per_page?: number }) =>
    api.get<{ orders: AdminOrder[]; total: number; page: number; per_page: number }>('/admin/orders', { params }),
  
  updateOrderStatus: (orderId: number, status: string) =>
    api.patch(`/admin/orders/${orderId}/status`, { status }),
  
  getUsers: (params?: { page?: number; limit?: number }) =>
    api.get<{ users: User[]; total: number }>('/admin/users', { params }),
  
  getStats: () => api.get<{
    total_revenue: number;
    total_orders: number;
    total_users: number;
    orders_today: number;
    revenue_today: number;
    success_rate: number;
  }>('/admin/stats'),
  
  createPromocode: (data: {
    code: string;
    discount_type: PromocodeDiscountType;
    discount_value: number;
    max_uses?: number | null;
    min_order_amount?: number | null;
    max_discount?: number | null;
    expires_at?: string | null;
  }) => api.post<Promocode>('/admin/promocode/create', data),

  getPromocodes: () => api.get<Promocode[]>('/admin/promocodes'),

  togglePromocode: (id: number) => api.patch<Promocode>(`/admin/promocode/${id}/toggle`),

  deletePromocode: (id: number) => api.delete(`/admin/promocode/${id}`),

  getBannerSlides: () => api.get<BannerSlide[]>('/admin/banner/slides'),

  createBannerSlide: (data: {
    title: string;
    image_url: string;
    sort_order?: number;
    is_active?: boolean;
    button_text?: string | null;
    button_link?: string | null;
  }) => api.post<BannerSlide>('/admin/banner/slides', data),

  updateBannerSlide: (
    slideId: number,
    data: {
      title?: string;
      image_url?: string;
      sort_order?: number;
      is_active?: boolean;
      button_text?: string | null;
      button_link?: string | null;
    },
  ) => api.patch<BannerSlide>(`/admin/banner/slides/${slideId}`, data),

  deleteBannerSlide: (slideId: number) =>
    api.delete(`/admin/banner/slides/${slideId}`),

  getFormSettings: () => api.get<FormSettings>('/admin/settings/forms'),

  updateFormSettings: (data: Partial<FormSettings>) =>
    api.patch<FormSettings>('/admin/settings/forms', data),
};

export default api;
