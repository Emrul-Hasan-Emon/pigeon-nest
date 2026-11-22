'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddressBook } from '@/components/addresses/address-book';
import { AdminUserProposals } from '@/components/admin/proposals/proposal-list';
import { AdminReviewList } from '@/components/admin/reviews/review-list';
import { AdminWishlistList } from '@/components/admin/wishlist/wishlist-list';
import { UserForm } from '@/components/admin/users/user-form';
import { getUser } from '@/lib/api/users';
import { NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { User } from '@/types/user';
import { LoadingBlock } from '@/components/ui/skeleton';

export default function UserDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser(Number(params.id))
      .then(setUser)
      .catch((error) => {
        if (error instanceof NotFoundApiError) {
          showToast('That user no longer exists.', 'error');
        } else {
          showToast('Failed to load user.', 'error');
        }
        router.replace('/admin/users');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <LoadingBlock />;
  }
  if (!user) return null;

  return (
    <div className="space-y-8">
      <UserForm user={user} key={user.id} />
      <section aria-label="Addresses" className="max-w-4xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Addresses</h2>
        <p className="mb-3 text-sm text-muted-foreground">Saved delivery addresses. Changes you make here are made on the customer&apos;s behalf.</p>
        <AddressBook owner={{ kind: 'user', userId: user.id }} variant="admin" onError={(m) => showToast(m, 'error')} />
      </section>
      <section aria-label="Wishlist" className="max-w-5xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Wishlist</h2>
        <p className="mb-3 text-sm text-muted-foreground">Products this customer saved, with live price and stock. Read only.</p>
        <AdminWishlistList userId={user.id} />
      </section>
      <section aria-label="Price proposals" className="max-w-4xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Price proposals</h2>
        <p className="mb-3 text-sm text-muted-foreground">The latest prices this customer offered. Open one to reject or cancel it.</p>
        <AdminUserProposals userId={user.id} />
      </section>
      <section aria-label="Reviews" className="max-w-6xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Reviews</h2>
        <p className="mb-3 text-sm text-muted-foreground">What this customer wrote. Open a review to hide or restore it.</p>
        <AdminReviewList userId={user.id} />
      </section>
    </div>
  );
}
