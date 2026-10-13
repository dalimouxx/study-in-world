'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td, Th } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Paginated, Partner, PartnerType } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';
import { PartnerFormDialog } from './partner-form';

const TYPES: PartnerType[] = ['UNIVERSITY', 'SCHOOL', 'TRAINING_CENTER', 'LANGUAGE_ORGANIZATION', 'AGENT', 'OTHER'];

export function PartnersPage() {
  return (
    <RequirePermission permission="partner.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('partners');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { can } = useAuth();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['partners', { page, search, type }],
    queryFn: () => api<Paginated<Partner>>('/partners', { query: { page, pageSize: 15, search, type } }),
    placeholderData: keepPreviousData,
  });

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={can('partner.manage') && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
      />

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <Input type="search" className="max-w-xs" placeholder={t('searchPlaceholder')} aria-label={tc('search')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Select className="max-w-[14rem]" aria-label={t('type')} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">{t('allTypes')}</option>
            {TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
          </Select>
        </div>

        {list.isError ? (
          <EmptyState title={errorMessage(list.error)} action={<Button variant="secondary" onClick={() => void list.refetch()}>{tc('retry')}</Button>} />
        ) : list.isLoading ? (
          <p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>{t('companyName')}</Th><Th>{t('type')}</Th><Th>{t('contact')}</Th><Th>{t('commission')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/partners/${p.id}`)}>
                    <Td><div className="font-medium">{p.companyName}</div>{!p.isActive && <Badge tone="neutral">{t('inactive')}</Badge>}</Td>
                    <Td>{t(`types.${p.type}`)}</Td>
                    <Td>{p.contactName ?? p.email ?? '–'}</Td>
                    <Td>{p.commissionType === 'PERCENTAGE' ? `${p.commissionValue}%` : p.commissionValue.toFixed(3)}</Td>
                    <Td />
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={15} total={list.data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      <PartnerFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
