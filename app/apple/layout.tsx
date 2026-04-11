import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Купить Apple Gift Card — подарочные карты Apple',
  description: 'Купить Apple Gift Card для любого региона: Россия, США, Турция и другие. Код придёт на email после оплаты. Быстро, надёжно, с минимальной наценкой.',
  keywords: ['Apple Gift Card', 'купить Apple Gift Card', 'подарочная карта Apple', 'Apple Gift Card Россия', 'Apple Gift Card Турция', 'Apple Gift Card США'],
  openGraph: {
    title: 'Купить Apple Gift Card — RugPay',
    description: 'Подарочные карты Apple для любого региона. Код на email после оплаты.',
  },
  alternates: {
    canonical: '/apple',
  },
};

export default function AppleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
