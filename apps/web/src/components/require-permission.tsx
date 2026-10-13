'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  const t = useTranslations('common');
  if (can(permission)) return <>{children}</>;
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md text-center">
      <p className="text-lg font-semibold">{t('forbiddenTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('forbiddenHint')}</p>
    </div>
  );
}
