import type { ReactNode } from 'react';
import { PartnerAuthProvider } from '@/features/partner-auth/partner-auth-context';

export default function PartnerPortalLayout({ children }: { children: ReactNode }) {
  return <PartnerAuthProvider>{children}</PartnerAuthProvider>;
}
