import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PortalSetPasswordForm } from '@/features/portal-auth/portal-set-password-form';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return (
    <Suspense>
      <PortalSetPasswordForm endpoint="/portal/auth/reset-password" title={t('resetTitle')} successMessage={t('resetDone')} />
    </Suspense>
  );
}
