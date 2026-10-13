import { setRequestLocale } from 'next-intl/server';
import { PartnerCommissionsPage } from '@/features/partner-portal/partner-commissions-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnerCommissionsPage />;
}
