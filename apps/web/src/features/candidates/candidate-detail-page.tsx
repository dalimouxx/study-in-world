'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Candidate, CandidateStatus, Paginated, Partner } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { cn, whatsappLink } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { ApplicationsTab } from './tabs/applications-tab';
import { ChecklistTab } from './tabs/checklist-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { FinanceTab } from './tabs/finance-tab';
import { HealthScoreCard } from './health-score-card';
import { AiSummaryButton } from './ai-summary-button';
import { MessagesTab } from './tabs/messages-tab';
import { TimelineTab } from './tabs/timeline-tab';
import { VisaTab } from './tabs/visa-tab';

const TABS = ['timeline', 'messages', 'documents', 'checklist', 'applications', 'visa', 'finance'] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<CandidateStatus, 'neutral' | 'primary' | 'success'> = { ACTIVE: 'success', ON_HOLD: 'primary', ARCHIVED: 'neutral' };

export function CandidateDetailPage({ candidateId }: { candidateId: string }) {
  return (
    <RequirePermission permission="candidate.view">
      <Content candidateId={candidateId} />
    </RequirePermission>
  );
}

function Content({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('timeline');

  const query = useQuery({ queryKey: ['candidates', candidateId], queryFn: () => api<Candidate>(`/candidates/${candidateId}`) });

  const invite = useMutation({
    mutationFn: () => api(`/candidates/${candidateId}/invite`, { method: 'POST' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId] }); toast.success(t('portalInviteSent')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  if (query.isError || !query.data) return <p role="alert" className="text-sm text-destructive">{errorMessage(query.error)}</p>;

  const c = query.data;

  return (
    <>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        description={[c.phone, c.email].filter(Boolean).join(' · ')}
        action={
          <div className="flex items-center gap-2">
            <AiSummaryButton candidateId={candidateId} />
            <Button variant="secondary" size="sm" onClick={() => window.open(whatsappLink(c.phone), '_blank')}>
              <MessageCircle className="h-4 w-4 text-success" aria-hidden />{t('whatsapp')}
            </Button>
            <Badge tone={STATUS_TONE[c.status]}>{t(`statuses.${c.status}`)}</Badge>
          </div>
        }
      />

      <HealthScoreCard candidateId={candidateId} />

      <Card className="mb-6 grid gap-3 p-5 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{t('nationality')}</dt><dd>{c.nationality ?? '–'}</dd></div>
        <div><dt className="text-muted-foreground">{t('passportNumber')}</dt><dd dir="ltr">{c.passportNumber ?? '–'}</dd></div>
        <div><dt className="text-muted-foreground">{t('assignedTo')}</dt><dd>{c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : '–'}</dd></div>
        <div>
          <dt className="text-muted-foreground">{t('partner')}</dt>
          <dd>
            {can('candidate.manage') ? (
              <PartnerLinkSelect candidateId={candidateId} value={c.partner?.id ?? ''} />
            ) : c.partner ? (
              <Link href={`/partners/${c.partner.id}`} className="text-primary underline-offset-4 hover:underline">{c.partner.companyName}</Link>
            ) : '–'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('portalAccess')}</dt>
          <dd>
            {c.portalActivatedAt ? (
              <Badge tone="success">{t('portalActive')}</Badge>
            ) : can('candidate.manage') ? (
              <Button size="sm" variant="secondary" disabled={!c.email} loading={invite.isPending} onClick={() => invite.mutate()}>
                <Send className="h-3.5 w-3.5" aria-hidden />{c.email ? t('invitePortal') : t('portalNeedsEmail')}
              </Button>
            ) : (
              <Badge tone="neutral">{t('portalNotActivated')}</Badge>
            )}
          </dd>
        </div>
      </Card>

      <div role="tablist" aria-label={t('title')} className="mb-4 flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 text-sm">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            type="button"
            onClick={() => setTab(key)}
            className={cn('shrink-0 rounded px-3 py-1.5 whitespace-nowrap', tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'timeline' && <TimelineTab candidateId={candidateId} />}
        {tab === 'messages' && <MessagesTab candidateId={candidateId} />}
        {tab === 'documents' && <DocumentsTab candidateId={candidateId} />}
        {tab === 'checklist' && <ChecklistTab candidateId={candidateId} />}
        {tab === 'applications' && <ApplicationsTab candidateId={candidateId} />}
        {tab === 'visa' && <VisaTab candidateId={candidateId} />}
        {tab === 'finance' && <FinanceTab candidateId={candidateId} hasPartner={!!c.partner} />}
      </div>
    </>
  );
}

function PartnerLinkSelect({ candidateId, value }: { candidateId: string; value: string }) {
  const t = useTranslations('candidates');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const partners = useQuery({ queryKey: ['partners', 'all-active'], queryFn: () => api<Paginated<Partner>>('/partners', { query: { pageSize: 100 } }) });

  const update = useMutation({
    mutationFn: (partnerId: string) => api(`/candidates/${candidateId}`, { method: 'PATCH', body: { partnerId: partnerId || null } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Select className="h-8 w-auto text-sm" aria-label={t('partner')} value={value} onChange={(e) => update.mutate(e.target.value)}>
      <option value="">{t('noPartner')}</option>
      {(partners.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.companyName}</option>)}
    </Select>
  );
}
