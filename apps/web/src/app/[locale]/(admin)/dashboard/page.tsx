import { setRequestLocale } from 'next-intl/server';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <DashboardPage />;
}
