'use client';

import { use, useEffect, useState } from 'react';
import { HelpTopicView } from '@/components/seller/help/help-topic-view';
import { SellerFrame } from '@/components/seller/seller-frame';
import { LoadingBlock } from '@/components/ui/skeleton';
import { getHelpTopic } from '@/lib/api/seller-help';
import { NotFoundApiError } from '@/lib/api/http';
import type { HelpTopic } from '@/lib/seller-help/types';

export default function SellerHelpTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = use(params);
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    getHelpTopic(slug)
      .then((t) => live && (setTopic(t), setState('ready')))
      .catch((e) => live && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      live = false;
    };
  }, [slug]);

  return (
    <SellerFrame width="max-w-4xl">
      {state === 'loading' && <LoadingBlock />}
      {state === 'missing' && <p className="text-base text-muted-foreground">We cannot find that Help topic. Choose one from the menu on the left.</p>}
      {state === 'error' && <p role="alert" className="text-base text-destructive">Help could not be loaded. Please try again later.</p>}
      {state === 'ready' && topic && <HelpTopicView topic={topic} />}
    </SellerFrame>
  );
}
