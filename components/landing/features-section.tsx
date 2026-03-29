import { Card, CardContent } from '@/components/ui/card';
import { Zap, Percent, Cog, Shield, Headphones } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Быстрое пополнение',
    description: 'Баланс зачисляется в течение 5 минут после подтверждения оплаты.',
  },
  {
    icon: Percent,
    title: 'Прозрачная комиссия',
    description: 'Фиксированная комиссия 10%* без скрытых платежей.',
  },
  {
    icon: Cog,
    title: 'Автоматическая обработка',
    description: 'Полностью автоматизированная система без ручной обработки.',
  },
  {
    icon: Shield,
    title: 'Безопасные платежи',
    description: 'Все транзакции шифруются и надежно защищены.',
  },
  {
    icon: Headphones,
    title: 'Поддержка 24/7',
    description: 'Наша команда поддержки всегда готова помочь.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Почему выбирают нас
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Мы предлагаем удобный сервис пополнения Steam с выгодными условиями и быстрым зачислением.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors"
            >
              <CardContent className="pt-6 text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
