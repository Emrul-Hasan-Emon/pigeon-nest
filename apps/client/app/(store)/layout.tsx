import { StoreFooter, StoreHeader } from '@/components/store/store-shell';
import { ToastProvider } from '@/components/ui/toast';
import { CartProvider } from '@/lib/cart/cart-context';
import { WishlistProvider } from '@/lib/wishlist/wishlist-context';

// Every customer-facing page shares this frame (plus the cart and wishlist state).
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CartProvider>
        <WishlistProvider>
          <div className="store flex min-h-screen flex-col">
            <StoreHeader />
            <main className="flex-1">{children}</main>
            <StoreFooter />
          </div>
        </WishlistProvider>
      </CartProvider>
    </ToastProvider>
  );
}
