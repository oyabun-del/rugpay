'use client';

import { useEffect, useState } from 'react';

const stats = [
  { label: 'Всего пополнений', value: 125840, suffix: '+', format: true },
  { label: 'Довольных пользователей', value: 48920, suffix: '+', format: true },
  { label: 'Среднее время обработки', value: 3, suffix: ' мин' },
  { label: 'Успешных платежей', value: 99.2, suffix: '%' },
];

function AnimatedNumber({ value, suffix, format }: { value: number; suffix: string; format?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatted = format
    ? displayValue.toLocaleString('ru-RU')
    : displayValue.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  return (
    <span>
      {formatted}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center animate-count-up"
            >
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                <AnimatedNumber
                  value={stat.value}
                  suffix={stat.suffix}
                  format={stat.format}
                />
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
