import { SellerSidebar } from './seller-sidebar';
import { SellerTopbar } from './seller-topbar';

type Active = Parameters<typeof SellerSidebar>[0]['active'];

/** The seller portal's chrome: sidebar, top bar and a content area that gets the shared "seller-main" styling. */
export function SellerFrame({ active, width = 'max-w-7xl', children }: { active: Active; width?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SellerSidebar active={active} />
      <SellerTopbar />
      <main className="seller-main ml-56 min-h-screen pt-16">
        <div className={`mx-auto ${width} px-6 py-8`}>{children}</div>
      </main>
    </div>
  );
}
