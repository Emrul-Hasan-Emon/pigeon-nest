'use client';

import { Heart } from 'lucide-react';
import { useWishlist } from '@/lib/wishlist/wishlist-context';

/** The heart. `card` floats over a product image; `inline` sits beside the buy button with a label. */
export function WishlistButton({
  productId,
  name,
  variant = 'card',
  className = '',
}: {
  productId: number;
  name: string;
  variant?: 'card' | 'inline';
  className?: string;
}) {
  const { isSaved, toggle, busy } = useWishlist();
  const saved = isSaved(productId);
  const label = saved ? `Remove ${name} from your wishlist` : `Save ${name} to your wishlist`;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={() => toggle(productId)}
        disabled={busy(productId)}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal disabled:opacity-60 ${
          saved ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-st-line bg-white text-st-ink hover:border-st-ink'
        } ${className}`}
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-rose-500 text-rose-500' : ''}`} aria-hidden />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={busy(productId)}
      aria-pressed={saved}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal disabled:opacity-60 ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-rose-500 text-rose-500' : 'text-st-ink'}`} aria-hidden />
    </button>
  );
}
