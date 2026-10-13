'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ExportButtons } from '@/components/export-buttons';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Forecast, ForecastPeriod } from '@/lib/types';

const PERIODS: ForecastPeriod[] = ['7d', '30d', '3m', '6m', '12m'];

export function ReportsPage() {
  return (
    <RequirePermission permission="finance.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [period, setPeriod] = useState<ForecastPeriod>('30d');

  const query = useQuery({ queryKey: ['reports', 'forecast', period], queryFn: () => api<Forecast>('/reports/forecast', { query: { period } }) });
  const f = query.data;

  const cards = f
    ? [
        { icon: ArrowDownCircle, label: t('collected'), value: f.collected, tone: 'text-success' },
        { icon: ArrowUpCircle, label: t('toCollect'), value: f.toCollect, tone: 'text-primary' },
        { icon: AlertTriangle, label: t('overdue'), value: f.overdue, tone: 'text-destructive' },
        { icon: Wallet, label: t('expensesInPeriod'), value: f.expenses, tone: 'text-muted-foreground' },
      ]
    : [];

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} action={<ExportButtons path={`/reports/forecast/export?period=${period}`} filenameBase="previsions" />} />

      <div className="mb-4 flex gap-2">
        {PERIODS.map((p) => (
          <Button key={p} size="sm" variant={period === p ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>{t(`periods.${p}`)}</Button>
        ))}
      </div>

      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : (
        <StaggerGroup className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Icon, label, value, tone }) => (
              <StaggerItem key={label}>
              <Card hoverable className="p-5">
                <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
                <p className="mt-2 text-xl font-semibold tabular-nums text-navy">{value.toFixed(3)}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </Card>
              </StaggerItem>
            ))}
          </div>
          {f && (
            <StaggerItem>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">{t('netCashFlow')}</p>
              <p className={`text-2xl font-semibold tabular-nums ${f.netCashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>{f.netCashFlow.toFixed(3)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('netCashFlowHint')}</p>
            </Card>
            </StaggerItem>
          )}
        </StaggerGroup>
      )}
    </>
  );
}
