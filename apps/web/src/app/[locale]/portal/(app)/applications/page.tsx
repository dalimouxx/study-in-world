import { setRequestLocale } from 'next-intl/server';
import { PortalApplicationsPage } from '@/features/portal/portal-applications-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalApplicationsPage />;
}
