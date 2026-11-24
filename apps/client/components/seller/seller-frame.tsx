'use client';

import { SellerSidebar } from './seller-sidebar';
import { SellerTopbar } from './seller-topbar';
import { useInSellerChrome } from './seller-chrome';

type Active = Parameters<typeof SellerSidebar>[0]['active'];

/**
 * A seller page's content area. The sidebar and top bar come from the layout (SellerChrome), so this only sets the
 * width. Outside the layout's chrome it draws them itself.
 */
export function SellerFrame({ active, width = 'max-w-7xl', children }: { active?: Active; width?: string; children: React.ReactNode }) {
  const inChrome = useInSellerChrome();
  const content = <div className={`mx-auto ${width} px-6 py-8`}>{children}</div>;
  if (inChrome) return content;
  return (
    <div className="min-h-screen bg-background">
      <SellerSidebar active={active} />
      <SellerTopbar />
      <main className="seller-main ml-56 min-h-screen pt-16">{content}</main>
    </div>
  );
}
