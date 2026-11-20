'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AddressBook } from '@/components/addresses/address-book';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { getUserToken } from '@/lib/auth/user-token';

export default function MyAddressesPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Your addresses | Pigeon Nest';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(!!getUserToken());
  }, []);

  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your addresses' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your addresses</h1>
      <p className="mb-4 text-sm text-st-slate">Save the places you send orders to, and pick one at checkout.</p>
      {signedIn === null ? null : !signedIn ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">Sign in to keep an address book</p>
          <p className="mt-1 text-sm text-st-slate">Guests can still enter an address at checkout.</p>
          <Link href="/user/login" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Sign in</Link>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <AddressBook owner={{ kind: 'me' }} variant="store" onError={setError} />
        </>
      )}
    </Container>
  );
}
