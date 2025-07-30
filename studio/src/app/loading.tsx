import { PageLoading } from '@/components/ui/loading';

/**
 * Global Loading Component for Next.js App Router
 * 
 * This component is automatically shown by Next.js when:
 * - Navigating between pages
 * - Loading page components
 * - During route transitions
 * 
 * It provides a consistent, branded loading experience
 * across the entire ReTag Marketplace application.
 */
export default function Loading() {
  return <PageLoading message="Loading ReTag Marketplace..." />;
}
