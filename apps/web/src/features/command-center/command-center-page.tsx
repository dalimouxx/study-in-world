'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CalendarClock, FileClock, ReceiptText, UserPlus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { CountUp, StaggerGroup, StaggerItem } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
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
        <SectionLabel>{t('today')}</SectionLabel>
        <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {todayCards.map(({ icon: Icon, label, value, href }, i) => (
            <StaggerItem key={i}>
              <Link href={href} className={cn('pop pop-hover flex h-full flex-col rounded-tile p-4', i === 0 ? 'bg-primary text-white' : 'bg-card')}>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-ink', i === 0 ? 'bg-white text-primary' : 'bg-primary-soft text-primary')}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-3 font-display text-2xl font-extrabold leading-none">
                  {typeof value === 'number' ? <CountUp value={value} /> : value}
                </p>
                <p className={cn('mt-1 text-xs', i === 0 ? 'text-white/85' : 'text-muted-foreground')}>{label}</p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="mb-8">
        <SectionLabel>{t('risks')}</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('overdueInvoices')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-destructive">{risks.data?.overdueInvoicesCount ?? '–'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('expiringDocuments')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-destructive">{risks.data?.expiringDocumentsCount ?? '–'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('stalledApplications')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-destructive">{risks.data?.stalledApplicationsCount ?? '–'}</p>
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
                  <Link href={`/candidates/${c.candidateId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-primary-soft/50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-destructive bg-destructive-soft text-destructive">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{c.candidateName}</span>
                      <span className="mt-1 flex flex-wrap gap-1">{c.reasons.map((r) => <Badge key={r} tone="danger">{r}</Badge>)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel className="mb-0">{t('finance')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>{t(`periods.${p}`)}</Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('collected')}</p><p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-success">{finance.data?.collected.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('toCollect')}</p><p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{finance.data?.toCollect.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('overdue')}</p><p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-destructive">{finance.data?.overdue.toFixed(3) ?? '–'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t('expenses')}</p><p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{finance.data?.expenses.toFixed(3) ?? '–'}</p></Card>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionLabel>{t('admissions')}</SectionLabel>
          <Card className="p-5">
            <StatusBars
              rows={APPLICATION_STATUSES.map((s) => ({ key: s, label: tCand(`applicationStatuses.${s}`), value: admissions.data?.byStatus[s] ?? 0 }))}
            />
          </Card>
        </section>
        <section>
          <SectionLabel>{t('visa')}</SectionLabel>
          <Card className="p-5">
            <StatusBars
              rows={VISA_STATUSES.map((s) => ({ key: s, label: tCand(`visaStatuses.${s}`), value: visa.data?.byStatus[s] ?? 0 }))}
            />
          </Card>
        </section>
      </div>
    </>
  );
}

/** Titre de section du Command Center. */
function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('mb-3 font-display text-xl font-extrabold tracking-tight text-ink', className)}>{children}</h2>;
}

/** Répartition par statut en barres horizontales qui se remplissent une seule fois (jamais en boucle). */
function StatusBars({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3 text-sm">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-display font-extrabold tabular-nums text-ink">{r.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-primary-soft">
            <motion.div
              className="h-full origin-left rounded-full bg-primary rtl:origin-right"
              style={{ width: `${(r.value / max) * 100}%` }}
              initial={{ scaleX: reduce ? 1 : 0 }}
              animate={{ scaleX: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
