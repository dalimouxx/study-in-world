import { setRequestLocale } from 'next-intl/server';
import { PortalFinancePage } from '@/features/portal/portal-finance-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalFinancePage />;
}
