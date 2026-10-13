'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { getPortalAccessToken, portalApi, portalApiBaseUrl } from '@/lib/portal-api';
import type { CandidateDocument, DocumentStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

const DOC_TYPES = ['PASSPORT', 'DIPLOMA', 'TRANSCRIPT', 'PHOTO', 'BANK_STATEMENT', 'OTHER'] as const;
const TONE: Record<DocumentStatus, 'neutral' | 'success' | 'danger'> = { PENDING: 'neutral', APPROVED: 'success', REJECTED: 'danger' };

export function PortalDocumentsPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>('PASSPORT');
  const [uploadLabel, setUploadLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({ queryKey: ['portal', 'documents'], queryFn: () => portalApi<CandidateDocument[]>('/portal/documents') });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new ApiError(400, 'FILE_REQUIRED', t('fileRequired'));
      const form = new FormData();
      form.append('type', uploadType);
      form.append('label', uploadLabel || file.name);
      form.append('file', file);
      const token = getPortalAccessToken();
      const res = await fetch(`${portalApiBaseUrl}/portal/documents`, { method: 'POST', body: form, credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { code?: string; message?: string });
        throw new ApiError(res.status, body.code, body.message ?? res.statusText);
      }
      return res.json() as Promise<CandidateDocument>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'documents'] });
      toast.success(t('documentUploaded'));
      setUploadOpen(false);
      setUploadLabel('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const docs = query.data ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('documentsTitle')}</h1>
          <p className="mt-1 text-muted-foreground">{t('documentsSubtitle')}</p>
        </div>
        <Button className="!rounded-full" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" aria-hidden />{t('uploadDocument')}</Button>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : docs.length === 0 ? (
        <EmptyState title={t('emptyDocuments')} />
      ) : (
        <div className="overflow-hidden rounded-organic border border-primary/10 bg-white shadow-sm">
          <Table>
            <thead><tr><Th>{t('documentType')}</Th><Th>{t('documentLabel')}</Th><Th>{t('status')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <Td>{t.has(`documentTypes.${d.type}`) ? t(`documentTypes.${d.type}`) : d.type}</Td>
                  <Td>{d.label} <span className="text-xs text-muted-foreground">v{d.version}</span></Td>
                  <Td><Badge tone={TONE[d.status]}>{t(`documentStatuses.${d.status}`)}</Badge></Td>
                  <Td>
                    <Button
                      variant="ghost" size="icon" aria-label={tc('download')}
                      onClick={() => {
                        const token = getPortalAccessToken();
                        fetch(`${portalApiBaseUrl}/portal/documents/${d.id}/download`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                          .then((r) => r.blob())
                          .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
                      }}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen} title={t('uploadDocument')} description={t('uploadHint')}>
        <div className="space-y-4">
          <Field label={t('documentType')} htmlFor="doc-type">
            <Select id="doc-type" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
              {DOC_TYPES.map((ty) => <option key={ty} value={ty}>{t(`documentTypes.${ty}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('documentLabel')} htmlFor="doc-label">
            <Input id="doc-label" value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder={t('documentLabelPlaceholder')} />
          </Field>
          <Field label={t('file')} htmlFor="doc-file" hint={t('fileHint')}>
            <input id="doc-file" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="block w-full text-sm" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>{tc('cancel')}</Button>
            <Button loading={upload.isPending} onClick={() => upload.mutate()}>{tc('save')}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
