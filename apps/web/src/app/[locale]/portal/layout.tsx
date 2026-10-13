import type { ReactNode } from 'react';
import { PortalAuthProvider } from '@/features/portal-auth/portal-auth-context';

/** Englobe toutes les pages /portal/* (connexion incluse) : le contexte doit exister avant la connexion elle-même. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalAuthProvider>{children}</PortalAuthProvider>;
}
