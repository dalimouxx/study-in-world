'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Branch, Employee, Paginated, Role } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { EmployeeFormDialog } from './employee-form';

export function EmployeesPage() {
  return (
    <RequirePermission permission="employee.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('employees');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['employees', { page, search, roleId, status }],
    queryFn: () => api<Paginated<Employee>>('/employees', { query: { page, pageSize: 15, search, roleId, status } }),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<Role[]>('/roles'), enabled: can('role.view') });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(t('deleted'));
      setDeleting(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const assignableRoles = (roles.data ?? []).filter((r) => r.code !== 'SUPER_ADMIN' || user?.roleCode === 'SUPER_ADMIN');
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          can('employee.create') && (
            <Button className="!rounded-full" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('new')}
            </Button>
          )
        }
      />

      <FadeIn>
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <Input
            type="search"
            className="max-w-xs"
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {roles.data && (
            <Select className="max-w-[12rem]" aria-label={t('role')} value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }}>
              <option value="">{t('allRoles')}</option>
              {roles.data.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          )}
          <Select className="max-w-[12rem]" aria-label={t('status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t('allStatuses')}</option>
            <option value="ACTIVE">{t('active')}</option>
            <option value="INACTIVE">{t('inactive')}</option>
          </Select>
        </div>

        {list.isError ? (
          <EmptyState title={errorMessage(list.error)} action={<Button variant="secondary" onClick={() => void list.refetch()}>{tc('retry')}</Button>} />
        ) : list.isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('empty')} hint={search || roleId || status ? t('emptyFiltered') : t('emptyHint')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('name')}</Th>
                  <Th>{t('role')}</Th>
                  <Th>{t('branch')}</Th>
                  <Th>{t('status')}</Th>
                  <Th>{t('lastLogin')}</Th>
                  <Th><span className="sr-only">{tc('actions')}</span></Th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <div className="font-medium">{e.firstName} {e.lastName}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{e.email}</div>
                    </Td>
                    <Td><Badge tone="primary">{e.role.name}</Badge></Td>
                    <Td>{e.branch?.name ?? '–'}</Td>
                    <Td>
                      <Badge tone={e.status === 'ACTIVE' ? 'success' : 'neutral'}>{e.status === 'ACTIVE' ? t('active') : t('inactive')}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{e.lastLoginAt ? formatDateTime(e.lastLoginAt, locale) : t('never')}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {can('employee.edit') && (
                          <Button variant="ghost" size="icon" aria-label={`${tc('edit')} ${e.firstName} ${e.lastName}`} onClick={() => { setEditing(e); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                        {can('employee.delete') && e.id !== user?.id && (
                          <Button variant="ghost" size="icon" aria-label={`${tc('delete')} ${e.firstName} ${e.lastName}`} onClick={() => setDeleting(e)}>
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
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
      </FadeIn>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} roles={assignableRoles} branches={branches.data ?? []} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: `${deleting?.firstName ?? ''} ${deleting?.lastName ?? ''}` })}
        confirmLabel={tc('delete')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
