'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { usePartnerAuth } from '@/features/partner-auth/partner-auth-context';
import { useRouter } from '@/i18n/navigation';

export function PartnerAuthGuard({ children }: { children: ReactNode }) {
  const { status } = usePartnerAuth();
  const router = useRouter();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/partner-portal/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }
  return <>{children}</>;
}
