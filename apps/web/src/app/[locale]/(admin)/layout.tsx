import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { AuthGuard } from '@/components/auth-guard';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
