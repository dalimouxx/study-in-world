import { setRequestLocale } from 'next-intl/server';
import { PortalContractsPage } from '@/features/portal/portal-contracts-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalContractsPage />;
}
