'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { StoreBanner } from '@/types/storefront';

export function HeroCarousel({ banners }: { banners: StoreBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative isolate h-[36svh] max-h-[340px] min-h-[270px] w-full overflow-hidden bg-st-ink text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {banners.map((banner, i) => {
        const active = i === index;
        return (
          <div
            key={banner.id}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.imageUrl}
              alt=""
              fetchPriority={i === 0 ? 'high' : 'auto'}
              className={`h-full w-full object-cover transition-transform duration-[7000ms] ease-out ${active ? 'scale-105' : 'scale-100'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-st-ink/85 via-st-ink/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-st-ink/55 via-transparent to-transparent" />
            {active && (
              <div key={`copy-${banner.id}`} className="store-rise absolute inset-x-0 bottom-0 mx-auto w-full max-w-7xl px-4 pb-[5.5rem] sm:px-6">
                <span className="store-sheen-rule mb-3 block h-[2px] w-10" />
                <h1 className="font-display max-w-[18ch] text-[clamp(1.5rem,3.6vw,2.7rem)] font-semibold leading-[1.05] text-balance">
                  {banner.title}
                </h1>
                {banner.linkUrl && (
                  <Link
                    href={banner.linkUrl}
                    className="mt-4 inline-flex items-center rounded-sm bg-white px-5 py-2 text-sm font-semibold text-st-ink transition-colors hover:bg-st-dove focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Shop now
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl items-center justify-between px-4 pb-10 sm:px-6">
          <div className="flex items-center gap-2" role="tablist" aria-label="Choose slide">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${i === index ? 'w-10 bg-white' : 'w-5 bg-white/40 hover:bg-white/70'}`}
              />
            ))}
          </div>
          <div className="hidden gap-2 sm:flex">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir === -1 ? 'Previous slide' : 'Next slide'}
                onClick={() => go(index + dir)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg backdrop-blur transition-colors hover:bg-white hover:text-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {dir === -1 ? '←' : '→'}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
