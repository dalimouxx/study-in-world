'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightCircle, Kanban, List, MessageCircle, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ExportButtons } from '@/components/export-buttons';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td, Th } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Paginated, Prospect, ProspectStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime, whatsappLink } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { ProspectFormDialog } from './prospect-form';
import { ProspectsBoard } from './prospects-board';

const STATUSES: ProspectStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const TONE: Record<ProspectStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  NEW: 'primary', CONTACTED: 'primary', QUALIFIED: 'success', CONVERTED: 'success', LOST: 'danger',
};
const CATEGORY_TONE = { hot: 'danger', warm: 'primary', cold: 'neutral' } as const;

export function ProspectsPage() {
  return (
    <RequirePermission permission="prospect.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('prospects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = useAuth();

  const [view, setView] = useState<'list' | 'board'>('list');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [converting, setConverting] = useState<Prospect | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['prospects', { page, search, status }],
    queryFn: () => api<Paginated<Prospect>>('/prospects', { query: { page, pageSize: 15, search, status } }),
    placeholderData: keepPreviousData,
    enabled: view === 'list',
  });

  const convert = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/prospects/${id}/convert`, { method: 'POST' }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success(t('converted'));
      setConverting(null);
      router.push(`/candidates/${id}`);
    },
    onError: (err) => { toast.error(errorMessage(err)); setConverting(null); },
  });

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex items-center gap-2">
            <ExportButtons path="/prospects/export" filenameBase="prospects" />
            {can('prospect.manage') && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('list')}><List className="h-4 w-4" aria-hidden />{t('viewList')}</Button>
        <Button variant={view === 'board' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('board')}><Kanban className="h-4 w-4" aria-hidden />{t('viewBoard')}</Button>
      </div>

      {view === 'board' ? (
        <ProspectsBoard />
      ) : (
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
            <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>
          ) : items.length === 0 ? (
            <EmptyState title={t('empty')} hint={t('emptyHint')} />
          ) : (
            <>
              <Table>
                <thead>
                  <tr><Th>{t('name')}</Th><Th>{t('score')}</Th><Th>{t('source')}</Th><Th>{t('status')}</Th><Th>{t('nextFollowUp')}</Th><Th>{t('assignedTo')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <Td><div className="font-medium">{p.firstName} {p.lastName}</div><div className="text-xs text-muted-foreground" dir="ltr">{p.phone}</div></Td>
                      <Td><Badge tone={CATEGORY_TONE[p.category]}>{p.score}</Badge></Td>
                      <Td>{t(`sources.${p.source}`)}</Td>
                      <Td><Badge tone={TONE[p.status]}>{t(`statuses.${p.status}`)}</Badge></Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{p.nextFollowUpAt ? formatDateTime(p.nextFollowUpAt, locale) : '–'}</Td>
                      <Td>{p.assignedTo ? `${p.assignedTo.firstName} ${p.assignedTo.lastName}` : '–'}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={t('whatsapp')} onClick={() => window.open(whatsappLink(p.phone), '_blank')}>
                            <MessageCircle className="h-4 w-4 text-success" aria-hidden />
                          </Button>
                          {can('prospect.manage') && p.status !== 'CONVERTED' && (
                            <Button variant="ghost" size="icon" aria-label={t('convert')} onClick={() => setConverting(p)}>
                              <ArrowRightCircle className="h-4 w-4 text-primary" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={15} total={list.data?.total ?? 0} onPage={setPage} />
            </>
          )}
        </Card>
      )}

      <ProspectFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <ConfirmDialog
        open={!!converting}
        onOpenChange={(o) => !o && setConverting(null)}
        title={t('convertTitle')}
        description={t('convertDescription', { name: `${converting?.firstName ?? ''} ${converting?.lastName ?? ''}` })}
        confirmLabel={t('convert')}
        loading={convert.isPending}
        onConfirm={() => converting && convert.mutate(converting.id)}
      />
    </>
  );
}
