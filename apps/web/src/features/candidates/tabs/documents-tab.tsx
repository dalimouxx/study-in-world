'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, ScanText, Trash2, TriangleAlert, Upload, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { api, ApiError, apiBaseUrl, getAccessToken } from '@/lib/api';
import type { CandidateDocument, DocumentStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { OcrExtractDialog } from './ocr-extract-dialog';

const DOC_TYPES = ['PASSPORT', 'DIPLOMA', 'TRANSCRIPT', 'PHOTO', 'BANK_STATEMENT', 'OTHER'] as const;
const TONE: Record<DocumentStatus, 'neutral' | 'success' | 'danger'> = { PENDING: 'neutral', APPROVED: 'success', REJECTED: 'danger' };

export function DocumentsTab({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<CandidateDocument | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>('PASSPORT');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');

  const query = useQuery({
    queryKey: ['candidates', candidateId, 'documents'],
    queryFn: () => api<CandidateDocument[]>(`/candidates/${candidateId}/documents`),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentStatus }) => api(`/documents/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'documents'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'documents'] });
      setDeleting(null);
    },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  // Upload multipart : hors du helper api() (qui envoie toujours du JSON), mais avec le même jeton et les mêmes cookies.
  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new ApiError(400, 'FILE_REQUIRED', t('fileRequired'));
      const form = new FormData();
      form.append('type', uploadType);
      form.append('label', uploadLabel || file.name);
      if (uploadExpiry) form.append('expiryDate', uploadExpiry);
      form.append('file', file);
      const token = getAccessToken();
      const res = await fetch(`${apiBaseUrl}/candidates/${candidateId}/documents`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { code?: string; message?: string });
        throw new ApiError(res.status, body.code, body.message ?? res.statusText);
      }
      return res.json() as Promise<CandidateDocument>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId, 'documents'] });
      toast.success(t('documentUploaded'));
      setUploadOpen(false);
      setUploadLabel('');
      setUploadExpiry('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const docs = query.data ?? [];
  const isExpiringSoon = (d: CandidateDocument) => d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 90 * 86_400_000;

  return (
    <div className="space-y-4">
      {can('document.manage') && (
        <div className="flex justify-end">
          <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" aria-hidden />{t('uploadDocument')}</Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : docs.length === 0 ? (
        <EmptyState title={t('emptyDocuments')} />
      ) : (
        <Table>
          <thead><tr><Th>{t('documentType')}</Th><Th>{t('documentLabel')}</Th><Th>{t('version')}</Th><Th>{t('expiryDate')}</Th><Th>{t('status')}</Th><Th><span className="sr-only">{tc('actions')}</span></Th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <Td>{t.has(`documentTypes.${d.type}`) ? t(`documentTypes.${d.type}`) : d.type}</Td>
                <Td>{d.label}</Td>
                <Td className="tabular-nums">v{d.version}</Td>
                <Td>
                  {d.expiryDate ? (
                    <span className={isExpiringSoon(d) ? 'inline-flex items-center gap-1 text-destructive' : ''}>
                      {isExpiringSoon(d) && <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                      {formatDateTime(d.expiryDate, locale)}
                    </span>
                  ) : '–'}
                </Td>
                <Td><Badge tone={TONE[d.status]}>{t(`documentStatuses.${d.status}`)}</Badge></Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost" size="icon" aria-label={tc('download')}
                      onClick={() => {
                        const token = getAccessToken();
                        // Le téléchargement passe par une balise <a> pour porter le jeton via un lien signé côté client.
                        fetch(`${apiBaseUrl}/documents/${d.id}/download`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                          .then((r) => r.blob())
                          .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
                      }}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </Button>
                    {can('document.manage') && d.type === 'PASSPORT' && d.mimeType.startsWith('image/') && (
                      <Button variant="ghost" size="icon" aria-label={t('ocrExtractTitle')} onClick={() => setExtracting(d.id)}>
                        <ScanText className="h-4 w-4 text-primary" aria-hidden />
                      </Button>
                    )}
                    {can('document.manage') && d.status === 'PENDING' && (
                      <>
                        <Button variant="ghost" size="icon" aria-label={t('approve')} onClick={() => review.mutate({ id: d.id, status: 'APPROVED' })}>
                          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t('reject')} onClick={() => review.mutate({ id: d.id, status: 'REJECTED' })}>
                          <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                        </Button>
                      </>
                    )}
                    {can('document.manage') && (
                      <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(d)}>
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
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
          <Field label={t('expiryDate')} htmlFor="doc-expiry" hint={t('expiryDateHint')}>
            <Input id="doc-expiry" type="date" dir="ltr" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>{tc('cancel')}</Button>
            <Button loading={upload.isPending} onClick={() => upload.mutate()}>{tc('save')}</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteDocumentTitle')}
        description={t('deleteDocumentDescription', { name: deleting?.label ?? '' })}
        confirmLabel={tc('delete')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />

      <OcrExtractDialog candidateId={candidateId} documentId={extracting} onOpenChange={(o) => !o && setExtracting(null)} />
    </div>
  );
}
