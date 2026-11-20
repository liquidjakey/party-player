import { Suspense } from 'react';
import { Queue } from './Queue';

export default function Page({ params }: PageProps<'/e/[slug]/queue'>) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted">Loading…</p>}>
      <Queue params={params} />
    </Suspense>
  );
}
