'use client';

import { Star } from 'lucide-react';

/** Read-only stars. Fractions are rounded to the nearest half for the fill. */
export function Stars({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = rounded >= i;
        const half = !full && rounded >= i - 0.5;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star width={size} height={size} className="absolute inset-0 text-amber-300/60" aria-hidden />
            {(full || half) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: full ? '100%' : '50%' }}>
                <Star width={size} height={size} className="fill-amber-400 text-amber-400" aria-hidden />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Five star buttons that act as one radio group. Arrow keys move the choice. */
export function StarInput({ value, onChange, label = 'Your rating' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex gap-1"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value || 0) + 1));
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value || 2) - 1));
          else return;
          e.preventDefault();
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} ${i === 1 ? 'star' : 'stars'}, ${WORDS[i]}`}
            tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
            onClick={() => onChange(i)}
            className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal"
          >
            <Star className={`h-7 w-7 ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-amber-300/70'}`} aria-hidden />
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-xs text-muted-foreground" aria-live="polite">{value ? WORDS[value] : 'Choose 1 to 5 stars'}</p>
    </div>
  );
}
