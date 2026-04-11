'use client';

import { TopupForm } from './topup-form';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { bannerApi, type BannerSlide } from '@/lib/api';
import { Button } from '@/components/ui/button';

const FALLBACK_SLIDES: BannerSlide[] = [
  {
    id: 1,
    title: 'Dimension Diva Set уже доступен',
    image_url: '/banners/dimension-diva-set.png',
    sort_order: 1,
    is_active: true,
    button_text: 'Пополнить Steam',
    button_link: '/?game=steam#topup',
  },
  {
    id: 2,
    title: 'Crimson Desert в продаже',
    image_url: '/banners/crimson-desert.png',
    sort_order: 2,
    is_active: true,
    button_text: 'Пополнить Steam',
    button_link: '/?game=steam#topup',
  },
];

const SLIDE_INTERVAL_MS = 7000;

export function HeroSection() {
  const [slides, setSlides] = useState<BannerSlide[]>(FALLBACK_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const loadSlides = async () => {
      try {
        const { data } = await bannerApi.getSlides();
        if (Array.isArray(data) && data.length > 0) {
          setSlides(data);
        }
      } catch {
        // Keep fallback slides when backend is unavailable.
      }
    };
    void loadSlides();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  const currentSlide = useMemo(() => {
    if (slides.length === 0) return null;
    return slides[Math.max(0, Math.min(activeIndex, slides.length - 1))];
  }, [activeIndex, slides]);

  return (
    <section id="topup" className="relative min-h-[calc(100vh-4rem)] flex items-center scroll-mt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-12 3xl:max-w-[1800px] 4xl:max-w-[2400px]">
        <div className="grid lg:grid-cols-[1.45fr_0.75fr] gap-6 md:gap-8 lg:gap-[45px] 3xl:gap-[60px] items-center">
          {/* Mobile banner — clickable link wrapper */}
          <div className="block lg:hidden w-full">
            <Link href={currentSlide?.button_link || '/#topup'} className="block relative h-[28vh] overflow-hidden rounded-2xl border border-border/50 bg-card/70 cursor-pointer">
              {currentSlide ? (
                slides.map((slide, idx) => (
                  <Image
                    key={slide.id}
                    src={slide.image_url}
                    alt={slide.title}
                    fill
                    className={`object-cover transition-opacity duration-1000 ease-in-out ${
                      idx === activeIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                    priority={idx === 0}
                  />
                ))
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/40 to-background/80" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute bottom-0 w-full p-5 text-center">
                <h2
                  key={currentSlide?.id || 'fallback-m'}
                  className="animate-fade-in text-2xl font-bold leading-tight text-white drop-shadow-sm"
                >
                  {currentSlide?.title || 'Пополняй баланс Steam и PUBG Mobile'}
                </h2>
                <div className="mt-3 flex justify-center gap-2">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Слайд ${idx + 1}`}
                      onClick={(e) => { e.preventDefault(); setActiveIndex(idx); }}
                      className={`h-2 rounded-full transition-all ${
                        idx === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop banner */}
          <div className="hidden lg:block w-full">
            <div className="relative h-[620px] 3xl:h-[780px] 4xl:h-[1000px] overflow-hidden rounded-2xl border border-border/50 bg-card/70">
              {currentSlide ? (
                slides.map((slide, idx) => (
                  <Image
                    key={slide.id}
                    src={slide.image_url}
                    alt={slide.title}
                    fill
                    className={`object-cover transition-opacity duration-1000 ease-in-out ${
                      idx === activeIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                    priority={idx === 0}
                  />
                ))
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/40 to-background/80" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute bottom-0 w-full p-6 md:p-8 3xl:p-10 text-center lg:text-left">
                <h1
                  key={currentSlide?.id || 'fallback'}
                  className="animate-fade-in text-3xl md:text-4xl lg:text-5xl 3xl:text-6xl 4xl:text-7xl font-bold leading-tight text-white drop-shadow-sm"
                >
                  {currentSlide?.title || 'Пополняй баланс Steam и PUBG Mobile'}
                </h1>
                {currentSlide?.button_text && (
                  <Link href={currentSlide.button_link || '/#topup'}>
                    <Button size="lg" className="mt-4 cursor-pointer">
                      {currentSlide.button_text}
                    </Button>
                  </Link>
                )}
                <div className="mt-4 flex justify-center lg:justify-start gap-2">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Слайд ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        idx === activeIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Suspense fallback={<div className="w-full max-w-[31rem] 3xl:max-w-[38rem] 4xl:max-w-[48rem] h-[620px] 3xl:h-[780px] 4xl:h-[1000px] bg-card/50 rounded-lg animate-pulse" />}>
              <TopupForm />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
