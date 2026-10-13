'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { portalApi } from '@/lib/portal-api';
import type { Application, ApplicationStatus } from '@/lib/types';

const TONE: Record<ApplicationStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  DRAFT: 'neutral', SUBMITTED: 'primary', UNDER_REVIEW: 'primary', ACCEPTED: 'success', REJECTED: 'danger', WAITLISTED: 'primary', WITHDRAWN: 'neutral',
};

export function PortalApplicationsPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['portal', 'applications'], queryFn: () => portalApi<Application[]>('/portal/applications') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('applicationsTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('applicationsSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyApplications')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((a) => (
              <StaggerItem key={a.id}>
                <Card hoverable className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-navy">{a.university}</p>
                      <p className="text-sm text-muted-foreground">{a.program} · {a.country} · {a.intake}</p>
                    </div>
                    <Badge tone={TONE[a.status]}>{t(`applicationStatuses.${a.status}`)}</Badge>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
