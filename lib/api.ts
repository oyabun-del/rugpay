import axios from 'axios';

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

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
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
  steam_nickname: string;
  amount: number;
  commission: number;
  final_amount: number;
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'failed';
  created_at: string;
  email?: string;
}

export interface Promocode {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed' | 'commission';
  discount_value: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
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

export interface PubgGiftOrderResponse {
  status: string;
  provider_order_id: string;
  amount_charged?: number;
  currency?: string;
  created_at?: string;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface BannerSlide {
  id: number;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
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
    email: string;
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
    email: string;
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

  calculate: (data: { amount: number; promocode?: string }) =>
    api.post<{ commission: number; final_amount: number; discount: number }>('/orders/calculate', data),

  getPaymentProviders: () => api.get<PaymentProvidersResponse>('/orders/payment-providers'),
};

// Payment page: public order info (no auth)
export interface PaymentOrderInfo {
  id: number;
  status: string;
  amount: number;
  final_amount: number;
  steam_nickname: string;
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
  createOrder: (data: { uid: string; uc_amount: number; promocode?: string }) =>
    api.post<PubgGiftOrderResponse>('/pubg/create', data),
};

export const bannerApi = {
  getSlides: () => api.get<BannerSlide[]>('/banner/slides'),
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
  getOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ orders: Order[]; total: number }>('/admin/orders', { params }),
  
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
    discount_type: string;
    discount_value: number;
    max_uses: number;
    expires_at?: string;
  }) => api.post<Promocode>('/admin/promocode/create', data),
  
  getPromocodes: () => api.get<{ promocodes: Promocode[] }>('/admin/promocodes'),
  
  togglePromocode: (id: number) => api.patch(`/admin/promocode/${id}/toggle`),

  getBannerSlides: () => api.get<BannerSlide[]>('/admin/banner/slides'),

  createBannerSlide: (data: {
    title: string;
    image_url: string;
    sort_order?: number;
    is_active?: boolean;
  }) => api.post<BannerSlide>('/admin/banner/slides', data),

  updateBannerSlide: (
    slideId: number,
    data: {
      title?: string;
      image_url?: string;
      sort_order?: number;
      is_active?: boolean;
    },
  ) => api.patch<BannerSlide>(`/admin/banner/slides/${slideId}`, data),
};

export default api;
