import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ResetForm } from '@/features/auth/reset-form';

export default async function ResetPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
