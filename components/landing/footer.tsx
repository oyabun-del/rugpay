import Link from 'next/link';
import { Mail } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="mb-4">
              <BrandLogo />
            </div>
            <p className="text-muted-foreground text-sm max-w-md">
              Быстрый и безопасный сервис пополнения Steam, PUBG Mobile
              и покупки Apple Gift Card. Выгодные условия и моментальная обработка.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Навигация</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Преимущества
                </Link>
              </li>
              <li>
                <Link
                  href="#how-it-works"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Как это работает
                </Link>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Вопросы
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Кабинет
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Документы</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Пользовательское соглашение
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Политика конфиденциальности
                </Link>
              </li>
            </ul>
            <div className="mt-6">
              <h4 className="font-semibold mb-2 text-sm">Поддержка</h4>
              <a
                href="mailto:gamecover@xraytune.ru"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                gamecover@xraytune.ru
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 mt-12 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} RugPay. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
