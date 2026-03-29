import Link from 'next/link';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Публичная оферта</h1>
          <p className="text-muted-foreground mb-8">(Пользовательское соглашение)</p>
          
          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Общие положения</h2>
              <p className="text-muted-foreground">
                Настоящий документ является официальным предложением (публичной офертой)
                сервиса по пополнению игровых аккаунтов (далее — «Сервис») заключить договор
                на оказание услуг.
              </p>
              <p className="text-muted-foreground mt-2">
                Любое физическое или юридическое лицо, использующее Сервис, считается
                принявшим условия данной Оферты (далее — «Пользователь»).
              </p>
              <p className="text-muted-foreground mt-2">
                Акцепт оферты осуществляется путем оформления и оплаты заказа.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Предмет договора</h2>
              <p className="text-muted-foreground">
                Сервис предоставляет услуги по пополнению баланса игровых аккаунтов, включая,
                но не ограничиваясь:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
                <li>Steam</li>
                <li>PUBG Mobile</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Сервис не является официальным представителем указанных платформ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. Порядок оказания услуг</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>3.1. Пользователь выбирает услугу и указывает необходимые данные (например, ID аккаунта).</li>
                <li>3.2. После оплаты заказ передается в обработку.</li>
                <li>
                  3.3. Срок выполнения услуги зависит от выбранного способа пополнения и обычно
                  составляет от нескольких минут до 24 часов.
                </li>
                <li>3.4. Сервис вправе запросить дополнительные данные для выполнения заказа.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Стоимость и оплата</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>4.1. Стоимость услуг указывается на сайте Сервиса.</li>
                <li>4.2. Оплата производится через доступные платежные системы.</li>
                <li>4.3. Моментом оплаты считается зачисление средств на счет Сервиса.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Возврат средств</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>5.1. Возврат возможен в следующих случаях:</li>
                <li className="ml-4">услуга не была оказана по вине Сервиса</li>
                <li className="ml-4">техническая ошибка при оплате</li>
                <li>5.2. Возврат не осуществляется, если:</li>
                <li className="ml-4">Пользователь указал неверные данные</li>
                <li className="ml-4">услуга была успешно оказана</li>
                <li>5.3. Срок рассмотрения заявки на возврат — до 5 рабочих дней.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Ответственность сторон</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>6.1. Сервис не несет ответственности за:</li>
                <li className="ml-4">ошибки, допущенные Пользователем при вводе данных</li>
                <li className="ml-4">ограничения со стороны игровых платформ</li>
                <li className="ml-4">
                  блокировки аккаунта по причинам, не связанным с действиями Сервиса
                </li>
                <li>6.2. Пользователь несет ответственность за достоверность предоставленных данных.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Ограничение ответственности</h2>
              <p className="text-muted-foreground">
                Сервис предоставляет услуги «как есть» и не гарантирует непрерывную или
                безошибочную работу.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Форс-мажор</h2>
              <p className="text-muted-foreground">
                Стороны освобождаются от ответственности за неисполнение обязательств вследствие
                обстоятельств непреодолимой силы (форс-мажор).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Изменение условий</h2>
              <p className="text-muted-foreground">
                Сервис вправе изменять условия настоящей Оферты без предварительного уведомления.
                Актуальная версия всегда доступна на сайте.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Срок действия</h2>
              <p className="text-muted-foreground">
                Оферта вступает в силу с момента публикации и действует бессрочно.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Контактная информация</h2>
              <p className="text-muted-foreground">
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
