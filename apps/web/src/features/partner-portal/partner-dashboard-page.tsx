'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Handshake, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { StatCardsSkeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import type { Commission, PartnerPortalCandidate, PartnerPortalProfile } from '@/lib/types';
import { usePartnerAuth } from '@/features/partner-auth/partner-auth-context';

const CARD_ACCENTS = ['#064BB5', '#39A9ED', '#0F9D58'];

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
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('welcome', { name: partnerUser?.firstName ?? '' })}</h1>
      <p className="mt-1 text-muted-foreground">{profile.data?.companyName ?? ''}</p>

      {[candidates, commissions].some((q) => q.isLoading) ? (
        <div className="mt-6"><StatCardsSkeleton count={3} /></div>
      ) : (
        <StaggerGroup className="mt-6 grid gap-4 sm:grid-cols-3">
          {cards.map(({ href, icon: Icon, label, value }, i) => (
            <StaggerItem key={i}>
              <Link href={href}>
                <Card hoverable className="flex items-center gap-4 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: CARD_ACCENTS[i % CARD_ACCENTS.length] }}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xl font-semibold text-navy">{value ?? '–'}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </span>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </>
  );
}
