import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вход в аккаунт',
  description: 'Войдите в личный кабинет RugPay для отслеживания заказов и управления аккаунтом.',
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
