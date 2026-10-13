import { setRequestLocale } from 'next-intl/server';
import { AppointmentsPage } from '@/features/appointments/appointments-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <AppointmentsPage />;
}
