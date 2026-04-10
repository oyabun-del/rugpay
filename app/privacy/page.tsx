import Link from 'next/link';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Политика конфиденциальности</h1>
          
          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Общие положения</h2>
              <p className="text-muted-foreground">
                Настоящая Политика конфиденциальности определяет порядок обработки и защиты
                персональных данных пользователей сервиса по пополнению игровых аккаунтов
                и продаже цифровых подарочных карт (далее — «Сервис»).
              </p>
              <p className="text-muted-foreground mt-2">
                Используя Сервис, пользователь соглашается с условиями данной Политики.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Какие данные мы собираем</h2>
              <p className="text-muted-foreground">
                Мы можем собирать следующие данные:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>Электронная почта</li>
                <li>Логин или ID игрового аккаунта (например, Steam ID или PUBG Mobile UID)</li>
                <li>Email для доставки цифровых подарочных карт (например, Apple Gift Card)</li>
                <li>Платежная информация (в обезличенном виде через платежные системы)</li>
                <li>IP-адрес, данные о браузере и устройстве</li>
                <li>История транзакций</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. Цели обработки данных</h2>
              <p className="text-muted-foreground">
                Ваши данные используются для:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>Обработки платежей, пополнения аккаунтов и доставки цифровых подарочных карт</li>
                <li>Идентификации пользователя</li>
                <li>Предоставления технической поддержки</li>
                <li>Улучшения качества сервиса</li>
                <li>Предотвращения мошенничества</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Передача данных третьим лицам</h2>
              <p className="text-muted-foreground">
                Мы можем передавать данные:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>Платежным системам для обработки транзакций</li>
                <li>
                  Партнёрам (например, поставщикам игровых услуг и цифровых подарочных карт) исключительно для выполнения
                  заказа
                </li>
                <li>Государственным органам — в случаях, предусмотренных законодательством</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Защита данных</h2>
              <p className="text-muted-foreground">
                Мы принимаем необходимые технические и организационные меры для защиты данных от:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>несанкционированного доступа</li>
                <li>изменения или уничтожения</li>
                <li>утечки информации</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Хранение данных</h2>
              <p className="text-muted-foreground">
                Персональные данные хранятся только в течение времени, необходимого для
                выполнения целей обработки, либо в соответствии с требованиями законодательства.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Права пользователя</h2>
              <p className="text-muted-foreground">Пользователь имеет право:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Запрашивать доступ к своим данным</li>
                <li>Требовать исправления или удаления данных</li>
                <li>Отозвать согласие на обработку данных</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Использование файлов cookie</h2>
              <p className="text-muted-foreground">
                Сервис может использовать cookies для:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>корректной работы сайта</li>
                <li>анализа поведения пользователей</li>
                <li>персонализации интерфейса</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Изменения политики</h2>
              <p className="text-muted-foreground">
                Мы можем обновлять данную Политику. Актуальная версия всегда доступна на сайте.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Контакты</h2>
              <p className="text-muted-foreground">
                По вопросам конфиденциальности вы можете связаться с нами:
              </p>
              <p className="text-muted-foreground mt-2">
                Email:{' '}
                <a href="mailto:gamecover@xraytune.ru" className="text-primary hover:underline">
                  gamecover@xraytune.ru
                </a>
              </p>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-border">
            <Link href="/" className="text-primary hover:underline">
              &larr; На главную
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
