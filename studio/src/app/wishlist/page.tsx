'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectLoading } from '@/components/ui/loading';

export default function WishlistPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the hash-based route
    router.replace('/#wishlist');
  }, [router]);

  return <RedirectLoading destination="wishlist" message="Loading your saved favorites..." />;
}
