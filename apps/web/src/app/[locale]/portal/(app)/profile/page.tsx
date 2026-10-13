import { setRequestLocale } from 'next-intl/server';
import { PortalProfilePage } from '@/features/portal/portal-profile-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalProfilePage />;
}
