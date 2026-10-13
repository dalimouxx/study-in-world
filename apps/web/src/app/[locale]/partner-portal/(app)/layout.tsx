import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PartnerAuthGuard } from '@/components/partner-auth-guard';
import { PartnerShell } from '@/components/partner-shell';

export default async function PartnerPortalAppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <PartnerAuthGuard>
      <PartnerShell>{children}</PartnerShell>
    </PartnerAuthGuard>
  );
}
