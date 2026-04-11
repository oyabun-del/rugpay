import { Header } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { GamesSection } from '@/components/landing/games-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { FAQSection } from '@/components/landing/faq-section';
import { Footer } from '@/components/landing/footer';

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Безопасно ли пользоваться сервисом?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Да, сервис полностью безопасен. Мы используем защищенную обработку платежей и шифрованные соединения. Пароль от Steam не требуются — нужно только имя пользователя.',
      },
    },
    {
      '@type': 'Question',
      name: 'Сколько времени занимает пополнение?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Обычно пополнение выполняется в течение 3–5 минут после подтверждения оплаты. В редких случаях при высокой нагрузке процесс может занять до 15 минут.',
      },
    },
    {
      '@type': 'Question',
      name: 'Какая комиссия за пополнение?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Стандартная комиссия — 10% от суммы пополнения. Вы можете использовать промокоды для скидки на комиссию.',
      },
    },
    {
      '@type': 'Question',
      name: 'Какие способы оплаты доступны?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Поддерживаются банковские карты и СБП.',
      },
    },
    {
      '@type': 'Question',
      name: 'Что делать, если пополнение не прошло?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Если пополнение не удалось, средства будут автоматически возвращены в течение 24 часов. Также вы можете обратиться в поддержку.',
      },
    },
    {
      '@type': 'Question',
      name: 'Можно ли вернуть деньги?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Возврат возможен только если пополнение не было завершено. После успешного зачисления средств в Steam возврат недоступен.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="flex-1">
        <HeroSection />
        <GamesSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
