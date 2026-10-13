import { setRequestLocale } from 'next-intl/server';
import { PortalVisaPage } from '@/features/portal/portal-visa-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalVisaPage />;
}
