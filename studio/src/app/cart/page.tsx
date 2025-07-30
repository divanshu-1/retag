'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectLoading } from '@/components/ui/loading';

export default function CartPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the hash-based route
    router.replace('/#cart');
  }, [router]);

  return <RedirectLoading destination="cart" message="Loading your shopping cart..." />;
}
