'use client';

import { PageLoader } from './page-loader';
import { useEffect, type ReactNode } from 'react';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';
import { useRouter } from '@/i18n/navigation';

export function PortalAuthGuard({ children }: { children: ReactNode }) {
  const { status } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/portal/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <PageLoader />;
  }
  return <>{children}</>;
}
