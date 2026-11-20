'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Horizontal scroll-snap row with arrow buttons that appear when there is more to see. */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  function scroll(dir: -1 | 1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        role="group"
        aria-label={label}
        className="store-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6"
      >
        {children}
      </div>
      {([-1, 1] as const).map((dir) => {
        const show = dir === -1 ? canPrev : canNext;
        return (
          <button
            key={dir}
            type="button"
            aria-label={dir === -1 ? `Scroll ${label} back` : `Scroll ${label} forward`}
            onClick={() => scroll(dir)}
            tabIndex={show ? 0 : -1}
            className={`absolute top-[38%] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-st-line bg-white text-lg shadow-md transition-all hover:bg-st-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal md:flex ${dir === -1 ? '-left-5' : '-right-5'} ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {dir === -1 ? '←' : '→'}
          </button>
        );
      })}
    </div>
  );
}
