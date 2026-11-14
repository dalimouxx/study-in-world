'use client';

import { PageLoader } from './page-loader';
import { useEffect, type ReactNode } from 'react';
import { usePartnerAuth } from '@/features/partner-auth/partner-auth-context';
import { useRouter } from '@/i18n/navigation';

export function PartnerAuthGuard({ children }: { children: ReactNode }) {
  const { status } = usePartnerAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/partner-portal/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <PageLoader />;
  }
  return <>{children}</>;
}
