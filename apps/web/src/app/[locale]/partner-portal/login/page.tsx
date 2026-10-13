import { setRequestLocale } from 'next-intl/server';
import { PartnerLoginForm } from '@/features/partner-auth/partner-login-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnerLoginForm />;
}
