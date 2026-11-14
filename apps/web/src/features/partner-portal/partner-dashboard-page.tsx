'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Handshake, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CountUp, StaggerGroup, StaggerItem } from '@/components/motion';
import { StatCardsSkeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import type { Commission, PartnerPortalCandidate, PartnerPortalProfile } from '@/lib/types';
import { usePartnerAuth } from '@/features/partner-auth/partner-auth-context';
import { MorphBlob } from '@/features/public/design-system';

export function PartnerDashboardPage() {
  const t = useTranslations('partnerPortal');
  const { partnerUser } = usePartnerAuth();

  const profile = useQuery({ queryKey: ['partner-portal', 'profile'], queryFn: () => partnerPortalApi<PartnerPortalProfile>('/partner-portal/profile') });
  const candidates = useQuery({ queryKey: ['partner-portal', 'candidates'], queryFn: () => partnerPortalApi<PartnerPortalCandidate[]>('/partner-portal/candidates') });
  const commissions = useQuery({ queryKey: ['partner-portal', 'commissions'], queryFn: () => partnerPortalApi<Commission[]>('/partner-portal/commissions') });

  const pendingCommissions = commissions.data?.filter((c) => c.status !== 'RECEIVED' && c.status !== 'CANCELLED').length ?? 0;

  const cards = [
    { href: '/partner-portal/candidates' as const, icon: Handshake, label: t('candidatesCount'), value: candidates.data?.length },
    { href: '/partner-portal/commissions' as const, icon: Wallet, label: t('pendingCommissions'), value: pendingCommissions },
    { href: '/partner-portal/commissions' as const, icon: FileText, label: t('totalCommissions'), value: commissions.data?.length },
  ];

  return (
    <>
      <div className="pop relative overflow-hidden rounded-tile bg-primary p-6 text-white sm:p-8">
        <MorphBlob className="-bottom-20 -end-16 h-64 w-64" />
        <h1 className="relative font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('welcome', { name: partnerUser?.firstName ?? '' })}</h1>
        <p className="relative mt-1 text-white/85">{profile.data?.companyName ?? ''}</p>
      </div>

      {[candidates, commissions].some((q) => q.isLoading) ? (
        <div className="mt-4"><StatCardsSkeleton count={3} /></div>
      ) : (
        <StaggerGroup className="mt-4 grid gap-3 sm:grid-cols-3">
          {cards.map(({ href, icon: Icon, label, value }, i) => (
            <StaggerItem key={i}>
              <Link href={href} className="pop pop-hover flex h-full flex-col gap-3 rounded-tile bg-card p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-ink bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-display text-3xl font-extrabold leading-none text-ink">{value === undefined ? '–' : <CountUp value={value} />}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </>
  );
}
