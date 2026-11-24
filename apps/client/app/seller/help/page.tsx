'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SellerFrame } from '@/components/seller/seller-frame';
import { listHelpTopics } from '@/lib/api/seller-help';

// Help opens on its first topic, whatever that is today (the menu comes from the server's content files).
export default function SellerHelpIndex() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    listHelpTopics()
      .then((t) => (t[0] ? router.replace(`/seller/help/${t[0].slug}`) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [router]);
  return <SellerFrame width="max-w-4xl">{failed ? <p className="text-base text-muted-foreground">Help could not be loaded. Please try again later.</p> : <p className="text-base text-muted-foreground">Loading…</p>}</SellerFrame>;
}
