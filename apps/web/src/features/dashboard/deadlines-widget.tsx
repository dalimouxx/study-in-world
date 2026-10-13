'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, FileText, Plane, Receipt, UserCheck, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { DeadlineItem, DeadlinesResponse, DeadlineUrgency } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const ICON = { APPLICATION: FileText, VISA: Plane, TASK: UserCheck, APPOINTMENT: CalendarClock, INVOICE: Receipt, PROSPECT: UserPlus };
const TONE: Record<DeadlineUrgency, 'danger' | 'primary' | 'neutral'> = { overdue: 'danger', today: 'danger', soon: 'primary', upcoming: 'neutral' };

/** Chaque échéance mène au dossier concerné ; un prospect n'a pas de fiche dédiée, on renvoie vers la liste. */
const hrefFor = (item: DeadlineItem): '/candidates/[id]' | '/prospects' | null =>
  item.candidateId ? (`/candidates/${item.candidateId}` as never) : item.kind === 'PROSPECT' ? '/prospects' : null;

/** Section 49 du cahier des charges : échéances centralisées, sur le tableau de bord. */
export function DeadlinesWidget() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const query = useQuery({ queryKey: ['dashboard', 'deadlines'], queryFn: () => api<DeadlinesResponse>('/dashboard/deadlines') });

  if (query.isLoading) return null;
  const items = query.data?.items.slice(0, 8) ?? [];

  return (
    <Card>
      <CardHeader title={t('upcomingDeadlines')} description={t('upcomingDeadlinesHint')} />
      {items.length === 0 ? (
        <EmptyState title={t('noDeadlines')} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const Icon = ICON[item.kind];
            const href = hrefFor(item);
            const content: ReactNode = (
              <>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.candidateName || '–'} · {formatDateTime(item.date, locale)}</span>
                </span>
                <Badge tone={TONE[item.urgency]}>{item.urgency === 'overdue' ? t('overdueLabel') : t('daysCount', { count: item.daysUntil })}</Badge>
              </>
            );
            return (
              <li key={`${item.kind}-${item.id}`}>
                {href ? (
                  <Link href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">{content}</Link>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
