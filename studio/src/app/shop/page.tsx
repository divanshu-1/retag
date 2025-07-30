'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectLoading } from '@/components/ui/loading';

export default function ShopPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the hash-based route
    router.replace('/#shop');
  }, [router]);

  return <RedirectLoading destination="shop" message="Taking you to our amazing collection..." />;
}
