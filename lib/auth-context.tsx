'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, authApi } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setSession: (accessToken: string, userData?: User | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const escaped = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const clearGuestCookies = () => {
    if (typeof document === 'undefined') return;
    document.cookie = 'guest_access_token=; Max-Age=0; path=/';
    document.cookie = 'guest_expires_at=; Max-Age=0; path=/';
  };

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me();
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, []);

  const setSession = useCallback(
    async (accessToken: string, userData?: User | null) => {
      setToken(accessToken);
      localStorage.setItem('token', accessToken);
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        await refreshUser();
      }
    },
    [refreshUser],
  );

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      setToken(storedToken);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      refreshUser();
      setIsLoading(false);
      return;
    }

    const guestToken = getCookieValue('guest_access_token');
    if (guestToken) {
      localStorage.setItem('token', guestToken);
      setToken(guestToken);
      refreshUser();
    }
    setIsLoading(false);
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      clearGuestCookies();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        throw new Error('Неверный email или пароль');
      }
      throw new Error('Ошибка входа. Попробуйте позже');
    }
  };

  const register = async (email: string, password: string, referralCode?: string) => {
    const response = await authApi.register({ email, password, referral_code: referralCode });
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    clearGuestCookies();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearGuestCookies();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
