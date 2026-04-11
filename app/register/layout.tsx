import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт RugPay для пополнения Steam, PUBG Mobile и покупки Apple Gift Card.',
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
