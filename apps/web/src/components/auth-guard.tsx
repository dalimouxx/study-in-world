'use client';

import { PageLoader } from './page-loader';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Protège l'interface. Les vraies autorisations restent appliquées par l'API à chaque requête. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Mot de passe provisoire à changer, ou double authentification obligatoire à activer : tout passe par Mon compte.
  const mustGoToAccount = !!user && (user.mustChangePassword || !!user.mustSetupTwoFactor);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && mustGoToAccount && pathname !== '/account') router.replace('/account');
  }, [status, mustGoToAccount, pathname, router]);

  if (status !== 'authenticated' || (mustGoToAccount && pathname !== '/account')) {
    return <PageLoader />;
  }
  return <>{children}</>;
}
