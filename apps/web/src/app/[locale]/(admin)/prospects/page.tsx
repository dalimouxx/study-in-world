import { setRequestLocale } from 'next-intl/server';
import { ProspectsPage } from '@/features/prospects/prospects-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ProspectsPage />;
}
