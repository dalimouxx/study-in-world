'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { portalApi } from '@/lib/portal-api';
import type { Appointment } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function PortalAppointmentsPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const query = useQuery({ queryKey: ['portal', 'appointments'], queryFn: () => portalApi<Appointment[]>('/portal/appointments') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('appointmentsTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('appointmentsSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyAppointments')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((a) => (
              <StaggerItem key={a.id}>
                <Card hoverable className="flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium text-navy">{a.title}</span>
                    <span className="text-sm text-muted-foreground">{formatDateTime(a.startAt, locale)}{a.location ? ` · ${a.location}` : ''}</span>
                  </span>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
