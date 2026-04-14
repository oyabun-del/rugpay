'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { settingsApi, type FormSettings } from '@/lib/api';

const ALL_GAMES = [
  { name: 'Steam', image: '/game-steam.png', mode: 'steam', settingsKey: 'steam_enabled' as keyof FormSettings },
  { name: 'Pubg Mobile', image: '/game-pubg.png', mode: 'pubg', settingsKey: 'pubg_enabled' as keyof FormSettings },
  { name: 'Подарочная карта Apple', image: '/game-apple.png', href: '/apple', settingsKey: 'apple_enabled' as keyof FormSettings },
  { name: 'Roblox', image: '/game-roblox.png', comingSoon: true },
];

export function GamesSection() {
  const [formSettings, setFormSettings] = useState<FormSettings>({ steam_enabled: true, pubg_enabled: true, apple_enabled: true });

  useEffect(() => {
    settingsApi.getFormSettings()
      .then(({ data }) => setFormSettings(data))
      .catch(() => {});
  }, []);

  const games = ALL_GAMES.map((game) => {
    if ('settingsKey' in game && game.settingsKey) {
      const enabled = formSettings[game.settingsKey];
      return { ...game, comingSoon: !enabled };
    }
    return game;
  });

  return (
    <section id="games" className="py-16 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Наш каталог
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Пополните кошелек Steam, PUBG Mobile и играйте в любимые проекты
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-4xl mx-auto">
          {games.map((game) => {
            const card = (
              <Card
                className="overflow-hidden group py-0 gap-0 hover:border-primary/40 transition-all duration-300 !bg-transparent !backdrop-filter-none !shadow-none border border-white/[0.1]"
              >
                <CardContent className="p-0">
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={game.image}
                      alt={game.name}
                      fill
                      className={`object-cover transition-all duration-500 ${game.comingSoon ? 'grayscale' : 'group-hover:scale-105'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {game.comingSoon && (
                      <div className="absolute top-2 right-2 rounded-lg glass-subtle px-2.5 py-1 text-xs font-semibold text-white">
                        Скоро...
                      </div>
                    )}
                    <h3 className="absolute bottom-3 left-3 right-3 font-bold text-sm md:text-base lg:text-lg text-white group-hover:text-primary transition-colors duration-300 leading-tight">
                      {game.name}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            );

            if (!game.comingSoon) {
              const href = 'href' in game && game.href ? game.href : `/?game=${game.mode}#topup`;
              return (
                <Link
                  key={game.name}
                  href={href}
                  className="block"
                  aria-label={`Перейти к форме пополнения ${game.name}`}
                >
                  {card}
                </Link>
              );
            }

            return <div key={game.name}>{card}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
