import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description: 'Политика конфиденциальности RugPay — как мы собираем, используем и защищаем персональные данные пользователей.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
