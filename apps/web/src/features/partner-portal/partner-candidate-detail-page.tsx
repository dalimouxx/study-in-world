'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { FadeIn } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import type { ApplicationStatus, PartnerComment, PartnerPortalCandidate, VisaStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';

const APP_TONE: Record<ApplicationStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  DRAFT: 'neutral', SUBMITTED: 'primary', UNDER_REVIEW: 'primary', ACCEPTED: 'success', REJECTED: 'danger', WAITLISTED: 'primary', WITHDRAWN: 'neutral',
};
const VISA_TONE: Record<VisaStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { NOT_STARTED: 'neutral', PREPARING: 'primary', SUBMITTED: 'primary', APPROVED: 'success', REFUSED: 'danger' };

export function PartnerCandidateDetailPage({ candidateId }: { candidateId: string }) {
  const t = useTranslations('partnerPortal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const candidate = useQuery({ queryKey: ['partner-portal', 'candidates', candidateId], queryFn: () => partnerPortalApi<PartnerPortalCandidate>(`/partner-portal/candidates/${candidateId}`) });
  const comments = useQuery({ queryKey: ['partner-portal', 'candidates', candidateId, 'comments'], queryFn: () => partnerPortalApi<PartnerComment[]>(`/partner-portal/candidates/${candidateId}/comments`) });

  const send = useMutation({
    mutationFn: () => partnerPortalApi(`/partner-portal/candidates/${candidateId}/comments`, { method: 'POST', body: { content } }),
    onSuccess: () => {
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['partner-portal', 'candidates', candidateId, 'comments'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (candidate.isLoading || !candidate.data) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  const c = candidate.data;

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{c.firstName} {c.lastName}</h1>

      <FadeIn>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('applications')} />
          {c.applications.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">{t('noApplications')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {c.applications.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>{a.university} — {a.program}</span>
                  <Badge tone={APP_TONE[a.status]}>{t(`applicationStatuses.${a.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t('visa')} />
          {c.visaFiles.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">{t('noVisa')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {c.visaFiles.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>{v.country}</span>
                  <Badge tone={VISA_TONE[v.status]}>{t(`visaStatuses.${v.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </FadeIn>

      <FadeIn delay={0.08}>
      <Card className="mt-6">
        <CardHeader title={t('comments')} description={t('commentsHint')} />
        <div className="space-y-3 px-5 pb-5">
          {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('noComments')}</p>}
          {comments.data?.map((cm) => (
            <div key={cm.id} className="rounded-2xl bg-primary-soft p-3 text-sm text-navy">
              <p>{cm.content}</p>
              <p className="mt-1 text-xs text-navy/60">{cm.partnerUser.firstName} {cm.partnerUser.lastName} · {formatDateTime(cm.createdAt, locale)}</p>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Textarea rows={2} className="flex-1" placeholder={t('commentPlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} />
            <Button className="!rounded-full" disabled={!content.trim()} loading={send.isPending} onClick={() => send.mutate()}>
              <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </Button>
          </div>
        </div>
      </Card>
      </FadeIn>
    </>
  );
}
