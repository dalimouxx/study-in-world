import { setRequestLocale } from 'next-intl/server';
import { PartnerDashboardPage } from '@/features/partner-portal/partner-dashboard-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnerDashboardPage />;
}
