'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/motion';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { BlogPost, Paginated } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

export function BlogPage() {
  return (
    <RequirePermission permission="blog.view">
      <Content />
    </RequirePermission>
  );
}

interface FormValues { title: string; excerpt: string; content: string; coverImageUrl: string }

function Content() {
  const t = useTranslations('blog');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const list = useQuery({ queryKey: ['blog'], queryFn: () => api<Paginated<BlogPost>>('/blog', { query: { pageSize: 50 } }) });
  const items = list.data?.items ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['blog'] });

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      editing
        ? api(`/blog/${editing.id}`, { method: 'PATCH', body: { ...v, coverImageUrl: v.coverImageUrl || undefined } })
        : api('/blog', { method: 'POST', body: { ...v, coverImageUrl: v.coverImageUrl || undefined } }),
    onSuccess: () => { toast.success(tc('save')); setFormOpen(false); void invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const togglePublish = useMutation({
    mutationFn: (post: BlogPost) => api(`/blog/${post.id}`, { method: 'PATCH', body: { status: post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' } }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/blog/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setDeleting(null); void invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ title: '', excerpt: '', content: '', coverImageUrl: '' }); setFormOpen(true); };
  const openEdit = (post: BlogPost) => { setEditing(post); reset({ title: post.title, excerpt: post.excerpt, content: post.content, coverImageUrl: post.coverImageUrl ?? '' }); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={can('blog.manage') && <Button className="!rounded-full" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden />{t('new')}</Button>}
      />
      <FadeIn>
      <Card>
        {list.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('empty')} hint={t('emptyHint')} />
        ) : (
          <Table>
            <thead><tr><Th>{t('postTitle')}</Th><Th>{t('status')}</Th><Th>{t('publishedAt')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr></thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id}>
                  <Td>
                    <p className="font-medium text-navy">{post.title}</p>
                    <p className="text-xs text-muted-foreground">{post.excerpt}</p>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => can('blog.manage') && togglePublish.mutate(post)} disabled={!can('blog.manage')}>
                      <Badge tone={post.status === 'PUBLISHED' ? 'success' : 'neutral'}>{t(`statuses.${post.status}`)}</Badge>
                    </button>
                  </Td>
                  <Td>{post.publishedAt ? formatDateTime(post.publishedAt, locale) : '–'}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {post.status === 'PUBLISHED' && (
                        <Button variant="ghost" size="icon" aria-label={t('viewOnSite')} onClick={() => window.open(`/${locale}/blog/${post.slug}`, '_blank')}>
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                      {can('blog.manage') && (
                        <>
                          <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(post)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(post)}>
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      </FadeIn>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('editTitle') : t('newTitle')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('postTitle')} htmlFor="post-title" error={errors.title?.message}>
            <Input id="post-title" {...register('title', { required: tc('required') })} />
          </Field>
          <Field label={t('excerpt')} htmlFor="post-excerpt" hint={t('excerptHint')} error={errors.excerpt?.message}>
            <Textarea id="post-excerpt" rows={2} {...register('excerpt', { required: tc('required') })} />
          </Field>
          <Field label={t('content')} htmlFor="post-content" hint={t('contentHint')} error={errors.content?.message}>
            <Textarea id="post-content" rows={10} {...register('content', { required: tc('required') })} />
          </Field>
          <Field label={t('coverImageUrl')} htmlFor="post-cover" hint={t('coverImageHint')}>
            <Input id="post-cover" dir="ltr" {...register('coverImageUrl')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle')}
        description={t('deleteDescription', { title: deleting?.title ?? '' })}
        confirmLabel={tc('delete')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
