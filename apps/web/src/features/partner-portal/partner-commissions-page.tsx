'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import type { Commission, CommissionStatus } from '@/lib/types';

const TONE: Record<CommissionStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { TO_CONFIRM: 'neutral', EXPECTED: 'primary', INVOICED: 'primary', PARTIALLY_RECEIVED: 'primary', RECEIVED: 'success', CANCELLED: 'danger' };

export function PartnerCommissionsPage() {
  const t = useTranslations('partnerPortal');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['partner-portal', 'commissions'], queryFn: () => partnerPortalApi<Commission[]>('/partner-portal/commissions') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('commissionsTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('commissionsSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyCommissions')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((c) => (
              <StaggerItem key={c.id}>
                <Card hoverable className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">{c.candidate ? `${c.candidate.firstName} ${c.candidate.lastName}` : '–'}</p>
                    <p className="text-sm text-muted-foreground">{c.amount.toFixed(3)} {c.currency}</p>
                  </div>
                  <Badge tone={TONE[c.status]}>{t(`commissionStatuses.${c.status}`)}</Badge>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
