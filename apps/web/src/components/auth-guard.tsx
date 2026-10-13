'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Protège l'interface. Les vraies autorisations restent appliquées par l'API à chaque requête. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && user?.mustChangePassword && pathname !== '/account') router.replace('/account');
  }, [status, user, pathname, router]);

  if (status !== 'authenticated' || (user?.mustChangePassword && pathname !== '/account')) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }
  return <>{children}</>;
}
