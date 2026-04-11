import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Публичная оферта',
  description: 'Пользовательское соглашение сервиса RugPay — условия пополнения Steam, PUBG Mobile и покупки Apple Gift Card.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
