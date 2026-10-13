import { setRequestLocale } from 'next-intl/server';
import { PartnerForgotForm } from '@/features/partner-auth/partner-forgot-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnerForgotForm />;
}
