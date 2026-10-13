'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, FileClock, ReceiptText, UserPlus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type {
  ApplicationStatus, CommandCenterAdmissions, CommandCenterRisks, CommandCenterToday, CommandCenterVisa, Forecast, ForecastPeriod, VisaStatus,
} from '@/lib/types';

const PERIODS: ForecastPeriod[] = ['7d', '30d', '3m', '6m', '12m'];
const APPLICATION_STATUSES: ApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'];
const VISA_STATUSES: VisaStatus[] = ['NOT_STARTED', 'PREPARING', 'SUBMITTED', 'APPROVED', 'REFUSED'];

export function CommandCenterPage() {
  return (
    <RequirePermission permission="command_center.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('commandCenter');
  const tc = useTranslations('common');
  const tCand = useTranslations('candidates');
  const [period, setPeriod] = useState<ForecastPeriod>('30d');

  const today = useQuery({ queryKey: ['command-center', 'today'], queryFn: () => api<CommandCenterToday>('/command-center/today') });
  const risks = useQuery({ queryKey: ['command-center', 'risks'], queryFn: () => api<CommandCenterRisks>('/command-center/risks') });
  const finance = useQuery({ queryKey: ['command-center', 'finance', period], queryFn: () => api<Forecast>('/command-center/finance', { query: { period } }) });
  const admissions = useQuery({ queryKey: ['command-center', 'admissions'], queryFn: () => api<CommandCenterAdmissions>('/command-center/admissions') });
  const visa = useQuery({ queryKey: ['command-center', 'visa'], queryFn: () => api<CommandCenterVisa>('/command-center/visa') });

  const todayCards = today.data
    ? [
        { icon: UserPlus, label: t('newProspects'), value: today.data.newProspects, href: '/prospects' as const },
        { icon: UserPlus, label: t('uncontacted'), value: today.data.uncontacted, href: '/prospects' as const },
        { icon: CalendarClock, label: t('appointmentsToday'), value: today.data.appointmentsToday, href: '/appointments' as const },
        { icon: FileClock, label: t('pendingDocuments'), value: today.data.pendingDocuments, href: '/candidates' as const },
        { icon: Wallet, label: t('paymentsToday'), value: today.data.paymentsToday.toFixed(3), href: '/reports' as const },
        { icon: ReceiptText, label: t('tasksToday'), value: today.data.tasksToday, href: '/tasks' as const },
      ]
    : [];

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('today')}</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {todayCards.map(({ icon: Icon, label, value, href }, i) => (
            <Link key={i} href={href}>
              <Card hoverable className="p-4">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('risks')}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('overdueInvoices')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{risks.data?.overdueInvoicesCount ?? '–'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('expiringDocuments')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{risks.data?.expiringDocumentsCount ?? '–'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('stalledApplications')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{risks.data?.stalledApplicationsCount ?? '–'}</p>
          </Card>
        </div>
        <Card className="mt-4">
          <CardHeader title={t('atRiskCandidates')} />
          {!risks.data?.atRiskCandidates.length ? (
            <EmptyState title={t('noRisks')} />
          ) : (
            <ul className="divide-y divide-border">
              {risks.data.atRiskCandidates.map((c) => (
                <li key={c.candidateId}>
                  <Link href={`/candidates/${c.candidateId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{c.candidateName}</span>
                      <span className="block text-xs text-muted-foreground">{c.reasons.join(' · ')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('finance')}</h2>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>{t(`periods.${p}`)}</Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('collected')}</p><p className="mt-1 text-xl font-semibold tabular-nums text-success">{finance.data?.collected.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('toCollect')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{finance.data?.toCollect.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('overdue')}</p><p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{finance.data?.overdue.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('expenses')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{finance.data?.expenses.toFixed(3) ?? '–'}</p></Card>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('admissions')}</h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {APPLICATION_STATUSES.map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tCand(`applicationStatuses.${s}`)}</span>
                  <span className="font-medium tabular-nums">{admissions.data?.byStatus[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('visa')}</h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {VISA_STATUSES.map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tCand(`visaStatuses.${s}`)}</span>
                  <span className="font-medium tabular-nums">{visa.data?.byStatus[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
