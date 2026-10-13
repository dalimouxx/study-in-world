import { setRequestLocale } from 'next-intl/server';
import { ReportsPage } from '@/features/reports/reports-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ReportsPage />;
}
