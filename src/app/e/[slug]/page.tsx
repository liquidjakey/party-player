import { Suspense } from 'react';
import { PickName } from './PickName';

export default function Page({ params }: PageProps<'/e/[slug]'>) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted">Loading…</p>}>
      <PickName params={params} />
    </Suspense>
  );
}
