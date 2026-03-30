'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

const games = [
  { name: 'Steam', image: '/game-steam.png', comingSoon: false, mode: 'steam' },
  { name: 'PUBG', image: '/game-pubg.png', comingSoon: false, mode: 'pubg' },
  { name: 'Roblox', image: '/game-roblox.png', comingSoon: true },
  { name: 'Genshin Impact', image: '/game-genshin.png', comingSoon: true },
];

export function GamesSection() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Наш каталог
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Пополните кошелек Steam, PUBG Mobile и играйте в любимые проекты
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {games.map((game) => {
            const card = (
              <Card
                className="border-border/50 overflow-hidden group py-0 gap-0 hover:border-primary/50 transition-all duration-300"
              >
                <CardContent className="p-0">
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={game.image}
                      alt={game.name}
                      fill
                      className={`object-cover transition-all duration-300 ${game.comingSoon ? 'grayscale' : ''}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    {game.comingSoon && (
                      <div className="absolute top-3 right-3 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                        Скоро...
                      </div>
                    )}
                    <h3 className="absolute bottom-3 left-3 font-semibold text-sm text-white group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            );

            if (!game.comingSoon && game.mode) {
              return (
                <Link
                  key={game.name}
                  href={`/?game=${game.mode}#topup`}
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
