import { setRequestLocale } from 'next-intl/server';
import { PortalLoginForm } from '@/features/portal-auth/portal-login-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalLoginForm />;
}
