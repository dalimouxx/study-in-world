'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ExportButtons } from '@/components/export-buttons';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Candidate, CandidateStatus, Paginated } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';
import { CandidateFormDialog } from './candidate-form';

const STATUSES: CandidateStatus[] = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'];
const TONE: Record<CandidateStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { ACTIVE: 'success', ON_HOLD: 'primary', ARCHIVED: 'neutral' };

export function CandidatesPage() {
  return (
    <RequirePermission permission="candidate.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { can } = useAuth();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['candidates', { page, search, status }],
    queryFn: () => api<Paginated<Candidate>>('/candidates', { query: { page, pageSize: 15, search, status } }),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex items-center gap-2">
            <ExportButtons path="/candidates/export" filenameBase="candidats" />
            {can('candidate.manage') && <Button className="!rounded-full" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
          </div>
        }
      />
      <FadeIn>
        <Card>
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <Input type="search" className="max-w-xs" placeholder={t('searchPlaceholder')} aria-label={tc('search')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <Select className="max-w-[12rem]" aria-label={t('status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{t('allStatuses')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
            </Select>
          </div>
          {list.isError ? (
            <EmptyState title={errorMessage(list.error)} action={<Button variant="secondary" onClick={() => void list.refetch()}>{tc('retry')}</Button>} />
          ) : list.isLoading ? (
            <TableSkeleton rows={8} cols={4} />
          ) : items.length === 0 ? (
            <EmptyState title={t('empty')} hint={t('emptyHint')} />
          ) : (
            <>
              <Table>
                <thead><tr><Th>{t('name')}</Th><Th>{t('status')}</Th><Th>{t('applications')}</Th><Th>{t('assignedTo')}</Th></tr></thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link href={`/candidates/${c.id}`} className="font-medium text-primary hover:underline">{c.firstName} {c.lastName}</Link>
                        <div className="text-xs text-muted-foreground" dir="ltr">{c.phone}</div>
                      </Td>
                      <Td><Badge tone={TONE[c.status]}>{t(`statuses.${c.status}`)}</Badge></Td>
                      <Td className="tabular-nums">{c._count.applications}</Td>
                      <Td>{c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : '–'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={15} total={list.data?.total ?? 0} onPage={setPage} />
            </>
          )}
        </Card>
      </FadeIn>
      <CandidateFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
