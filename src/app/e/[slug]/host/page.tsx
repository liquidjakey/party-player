import { Suspense } from 'react';
import { Host } from './Host';

export default function Page({ params }: PageProps<'/e/[slug]/host'>) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted">Loading…</p>}>
      <Host params={params} />
    </Suspense>
  );
}
