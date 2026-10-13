import { setRequestLocale } from 'next-intl/server';
import { PortalAppointmentsPage } from '@/features/portal/portal-appointments-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalAppointmentsPage />;
}
