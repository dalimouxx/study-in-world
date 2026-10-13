'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';
import { useRouter } from '@/i18n/navigation';

export function PortalAuthGuard({ children }: { children: ReactNode }) {
  const { status } = usePortalAuth();
  const router = useRouter();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/portal/login');
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
