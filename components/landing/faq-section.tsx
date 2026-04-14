import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'Безопасно ли пользоваться сервисом?',
    answer:
      'Да, сервис полностью безопасен. Мы используем защищенную обработку платежей и шифрованные соединения. Пароль от Steam не требуются — нужно только имя пользователя.',
  },
  {
    question: 'Сколько времени занимает пополнение?',
    answer:
      'Обычно пополнение выполняется в течение 3–5 минут после подтверждения оплаты. В редких случаях при высокой нагрузке процесс может занять до 15 минут.',
  },
  {
    question: 'Какая комиссия за пополнение?',
    answer:
      'Стандартная комиссия — 10% от суммы пополнения. Вы можете использовать промокоды для скидки на комиссию.',
  },
  {
    question: 'Какие способы оплаты доступны?',
    answer:
      'Поддерживаются банковские карты и СБП.',
  },
  {
    question: 'Что делать, если пополнение не прошло?',
    answer:
      'Если пополнение не удалось, средства будут автоматически возвращены в течение 24 часов. Также вы можете обратиться в поддержку.',
  },
  {
    question: 'Можно ли вернуть деньги?',
    answer:
      'Возврат возможен только если пополнение не было завершено. После успешного зачисления средств в Steam возврат недоступен.',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Часто задаваемые вопросы
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ответы на популярные вопросы о работе сервиса
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-elevated rounded-2xl px-6 border-0"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
