'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import type { CandidateStatus, PartnerPortalCandidate } from '@/lib/types';

const TONE: Record<CandidateStatus, 'neutral' | 'primary' | 'success'> = { ACTIVE: 'success', ON_HOLD: 'primary', ARCHIVED: 'neutral' };

export function PartnerCandidatesPage() {
  const t = useTranslations('partnerPortal');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['partner-portal', 'candidates'], queryFn: () => partnerPortalApi<PartnerPortalCandidate[]>('/partner-portal/candidates') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('candidatesTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('candidatesSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyCandidates')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((c) => (
              <StaggerItem key={c.id}>
                <Link href={`/partner-portal/candidates/${c.id}`}>
                  <Card hoverable className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-navy">{c.firstName} {c.lastName}</p>
                      <p className="text-sm text-muted-foreground">{t('applicationsCount', { count: c.applications.length })}</p>
                    </div>
                    <Badge tone={TONE[c.status]}>{t(`statuses.${c.status}`)}</Badge>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
