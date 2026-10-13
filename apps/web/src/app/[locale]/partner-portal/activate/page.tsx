import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PartnerSetPasswordForm } from '@/features/partner-auth/partner-set-password-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'partnerPortal' });
  return (
    <Suspense>
      <PartnerSetPasswordForm endpoint="/partner-portal/auth/activate" title={t('activateTitle')} successMessage={t('activateDone')} />
    </Suspense>
  );
}
