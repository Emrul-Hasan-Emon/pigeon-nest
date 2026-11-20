import { StoreFooter, StoreHeader } from '@/components/store/store-shell';
import { CartProvider } from '@/lib/cart/cart-context';

// Every customer-facing page shares this frame (and the cart state).
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="store flex min-h-screen flex-col">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter />
      </div>
    </CartProvider>
  );
}
