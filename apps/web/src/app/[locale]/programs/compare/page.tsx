import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ProgramsComparePage } from '@/features/public/programs-compare-page';

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ids?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const ids = (sp.ids ?? '').split(',').filter(Boolean);
  return (
    <Suspense>
      <ProgramsComparePage ids={ids} />
    </Suspense>
  );
}
