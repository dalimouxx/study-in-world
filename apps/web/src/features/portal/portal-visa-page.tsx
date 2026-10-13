'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { portalApi } from '@/lib/portal-api';
import type { ChecklistItem, VisaFile, VisaStatus } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

const TONE: Record<VisaStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { NOT_STARTED: 'neutral', PREPARING: 'primary', SUBMITTED: 'primary', APPROVED: 'success', REFUSED: 'danger' };

function VisaChecklistReadOnly({ visaFileId }: { visaFileId: string }) {
  const t = useTranslations('portal');
  const query = useQuery({ queryKey: ['portal', 'visa', visaFileId, 'checklist'], queryFn: () => portalApi<ChecklistItem[]>(`/portal/visa-files/${visaFileId}/checklist`) });
  const items = query.data ?? [];
  if (items.length === 0) return null;
  const done = items.filter((i) => i.status === 'DONE').length;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{t('visaChecklist')}</span>
        <span>{done}/{items.length}</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]', item.status === 'DONE' ? 'border-success bg-success text-white' : 'border-border')}>
              {item.status === 'DONE' ? '✓' : item.status === 'NOT_APPLICABLE' ? '–' : ''}
            </span>
            <span className={item.status === 'NOT_APPLICABLE' ? 'text-muted-foreground line-through' : ''}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortalVisaPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const query = useQuery({ queryKey: ['portal', 'visa'], queryFn: () => portalApi<VisaFile[]>('/portal/visa-files') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('visaTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('visaSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyVisa')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((v) => (
              <StaggerItem key={v.id}>
                <Card hoverable className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-navy">{v.country}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                        {v.visaCenter && <span>{v.visaCenter}</span>}
                        {v.appointmentDate && <span>{t('appointment')} : {formatDateTime(v.appointmentDate, locale)}</span>}
                      </div>
                    </div>
                    <Badge tone={TONE[v.status]}>{t(`visaStatuses.${v.status}`)}</Badge>
                  </div>
                  <VisaChecklistReadOnly visaFileId={v.id} />
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
