import { User, CreditCard, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    icon: User,
    step: '01',
    title: 'Введите ник Steam',
    description: 'Укажите имя пользователя Steam, чтобы мы зачислили средства на нужный аккаунт.',
  },
  {
    icon: CreditCard,
    step: '02',
    title: 'Оплатите заказ',
    description: 'Выберите удобный способ оплаты и безопасно завершите платеж.',
  },
  {
    icon: CheckCircle2,
    step: '03',
    title: 'Баланс пополнен',
    description: 'Баланс Steam будет автоматически пополнен в течение нескольких минут.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Как это работает
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Три простых шага для пополнения кошелька Steam
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step) => (
            <div key={step.step} className="relative">
              <div className="relative flex flex-col items-center text-center">
                <div className="mb-4 relative">
                  <div className="h-24 w-24 rounded-full glass-elevated flex items-center justify-center border border-primary/20">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-[0_2px_12px_-2px_oklch(0.65_0.24_270_/_0.5)]">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
