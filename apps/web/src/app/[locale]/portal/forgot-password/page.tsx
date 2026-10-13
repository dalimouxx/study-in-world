import { setRequestLocale } from 'next-intl/server';
import { PortalForgotForm } from '@/features/portal-auth/portal-forgot-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalForgotForm />;
}
