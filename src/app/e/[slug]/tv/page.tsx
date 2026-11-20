import { Suspense } from 'react';
import { Tv } from './Tv';

export default function Page({ params }: PageProps<'/e/[slug]/tv'>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <Tv params={params} />
    </Suspense>
  );
}
