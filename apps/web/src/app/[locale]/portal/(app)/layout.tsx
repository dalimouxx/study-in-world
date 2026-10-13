import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PortalAuthGuard } from '@/components/portal-auth-guard';
import { PortalShell } from '@/components/portal-shell';

export default async function PortalAppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <PortalAuthGuard>
      <PortalShell>{children}</PortalShell>
    </PortalAuthGuard>
  );
}
