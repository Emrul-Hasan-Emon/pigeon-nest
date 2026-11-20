'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeroCarousel } from '@/components/store/hero-carousel';
import { PicksStrip } from '@/components/store/picks-strip';
import { SectionBlock } from '@/components/store/section-block';
import { getHomepage } from '@/lib/api/storefront';
import type { StoreBanner, StoreDevice, StoreSection } from '@/types/storefront';

const MOBILE_QUERY = '(max-width: 767px)';

function HomeSkeleton() {
  return (
    <div className="store-skeleton" aria-busy="true" aria-label="Loading">
      <div className="h-[40svh] min-h-[280px] bg-st-ink-2" />
      <div className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-4 px-4 sm:px-6 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-st-line" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [device, setDevice] = useState<StoreDevice | null>(null);
  const [sections, setSections] = useState<StoreSection[] | null>(null);
  const [slots, setSlots] = useState<StoreSection[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const apply = () => setDevice(media.matches ? 'mobile' : 'web');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const load = useCallback(async (target: StoreDevice) => {
    setFailed(false);
    try {
      const [main, picks] = await Promise.all([getHomepage(target, 'main'), getHomepage(target, 'slots')]);
      setSections(main.sections);
      setSlots(picks.sections);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (device) load(device);
  }, [device, load]);

  // The first carousel of banners is the hero; every other banner section is a promo block.
  const heroIndex = sections?.findIndex((s) => s.sectionType === 'banners' && s.layout === 'carousel') ?? -1;
  const hero = heroIndex >= 0 ? (sections![heroIndex].items as StoreBanner[]) : [];
  const rest = (sections ?? []).filter((_, i) => i !== heroIndex);

  return (
    <>
      {failed ? (
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="font-display text-2xl font-semibold">We couldn&apos;t load the homepage</h1>
          <p className="mt-2 text-st-slate">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => device && load(device)}
            className="mt-6 rounded-full bg-st-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-st-teal"
          >
            Try again
          </button>
        </div>
      ) : sections === null ? (
        <HomeSkeleton />
      ) : sections.length === 0 && slots.length === 0 ? (
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="font-display text-2xl font-semibold">The shop is being set up</h1>
          <p className="mt-2 text-st-slate">New birds and supplies will appear here soon.</p>
        </div>
      ) : (
        <>
          <HeroCarousel banners={hero} />
          <PicksStrip slots={slots} />
          <div className={`space-y-7 sm:space-y-9 ${hero.length > 0 || slots.length > 0 ? 'pt-7 sm:pt-9' : 'pt-6'}`}>
            {rest.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
