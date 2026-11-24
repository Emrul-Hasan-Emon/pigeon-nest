'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import { SellerSidebar } from './seller-sidebar';
import { SellerTopbar } from './seller-topbar';

// True while the page sits inside the portal's persistent chrome (see SellerChrome).
const InChromeContext = createContext(false);
export const useInSellerChrome = () => useContext(InChromeContext);

// Pages that are shown on their own, without the menu: signing in and registering.
const BARE = ['/seller/login', '/seller/register'];

/**
 * The seller portal's sidebar and top bar, kept in the layout so they stay mounted while you move between pages.
 * Only the page content changes: no flash, and the menu does not reload its counts.
 */
export function SellerChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <InChromeContext.Provider value>
      <div className="min-h-screen bg-background">
        <SellerSidebar />
        <SellerTopbar />
        <main className="seller-main ml-56 min-h-screen pt-16">{children}</main>
      </div>
    </InChromeContext.Provider>
  );
}
