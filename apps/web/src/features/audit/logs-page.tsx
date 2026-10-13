'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { ActivityEntry, LoginEntry, Paginated } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 25;

export function LogsPage() {
  return (
    <RequirePermission permission="audit.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('logs');
  const [tab, setTab] = useState<'activity' | 'logins'>('activity');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div role="tablist" aria-label={t('title')} className="mb-4 inline-flex rounded-md border border-border bg-card p-0.5 text-sm">
        {(['activity', 'logins'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            type="button"
            onClick={() => setTab(k)}
            className={cn('rounded px-4 py-1.5', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      <Card>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'activity' ? <ActivityTable /> : <LoginsTable />}
        </div>
      </Card>
    </>
  );
}

function ActivityTable() {
  const t = useTranslations('logs');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['audit', 'activity', page],
    queryFn: () => api<Paginated<ActivityEntry>>('/audit/activity', { query: { page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  if (q.isError) return <EmptyState title={errorMessage(q.error)} action={<Button variant="secondary" onClick={() => void q.refetch()}>{tc('retry')}</Button>} />;
  if (q.isLoading) return <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>;
  if (!q.data?.items.length) return <EmptyState title={t('emptyActivity')} />;

  return (
    <>
      <Table>
        <thead>
          <tr><Th>{t('date')}</Th><Th>{t('user')}</Th><Th>{t('action')}</Th><Th>{t('ip')}</Th></tr>
        </thead>
        <tbody>
          {q.data.items.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt, locale)}</Td>
              <Td>{e.userName ?? '–'}</Td>
              <Td>{t.has(`actions.${e.action}`) ? t(`actions.${e.action}`) : e.action}</Td>
              <Td dir="ltr" className="text-start font-mono text-xs text-muted-foreground">{e.ip ?? '–'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
    </>
  );
}

function LoginsTable() {
  const t = useTranslations('logs');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['audit', 'logins', page],
    queryFn: () => api<Paginated<LoginEntry>>('/audit/logins', { query: { page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  if (q.isError) return <EmptyState title={errorMessage(q.error)} action={<Button variant="secondary" onClick={() => void q.refetch()}>{tc('retry')}</Button>} />;
  if (q.isLoading) return <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>;
  if (!q.data?.items.length) return <EmptyState title={t('emptyLogins')} />;

  return (
    <>
      <Table>
        <thead>
          <tr><Th>{t('date')}</Th><Th>{t('email')}</Th><Th>{t('result')}</Th><Th>{t('ip')}</Th></tr>
        </thead>
        <tbody>
          {q.data.items.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt, locale)}</Td>
              <Td dir="ltr" className="text-start">{e.email}</Td>
              <Td>
                {e.success ? (
                  <Badge tone="success">{t('success')}</Badge>
                ) : (
                  <Badge tone="danger">{e.reason && t.has(`reasons.${e.reason}`) ? t(`reasons.${e.reason}`) : t('failed')}</Badge>
                )}
              </Td>
              <Td dir="ltr" className="text-start font-mono text-xs text-muted-foreground">{e.ip ?? '–'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
    </>
  );
}
