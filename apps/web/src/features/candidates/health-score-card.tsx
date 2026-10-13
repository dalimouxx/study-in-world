'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { HealthCategory, HealthScore, IssueSeverity } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORY_TONE: Record<HealthCategory, 'success' | 'primary' | 'danger'> = { good: 'success', watch: 'primary', risk: 'danger' };
const SEVERITY_ICON: Record<IssueSeverity, typeof AlertTriangle> = { CRITICAL: ShieldAlert, IMPORTANT: AlertTriangle, ATTENTION: AlertTriangle, INFO: Info };
const SEVERITY_COLOR: Record<IssueSeverity, string> = { CRITICAL: 'text-destructive', IMPORTANT: 'text-destructive', ATTENTION: 'text-primary', INFO: 'text-muted-foreground' };

/** Section 21 (Health Score) + section 26 (détection de problèmes) : un signal pour le conseiller, jamais une décision automatique. */
export function HealthScoreCard({ candidateId }: { candidateId: string }) {
  const t = useTranslations('candidates');
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({ queryKey: ['candidates', candidateId, 'health-score'], queryFn: () => api<HealthScore>(`/candidates/${candidateId}/health-score`) });

  if (query.isLoading || !query.data) return null;
  const { score, category, issues } = query.data;
  const visible = expanded ? issues : issues.slice(0, 3);

  return (
    <Card className="mb-6 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {category === 'good' ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <ShieldAlert className={cn('h-5 w-5', category === 'risk' ? 'text-destructive' : 'text-primary')} aria-hidden />}
          <div>
            <p className="text-sm font-medium">{t('healthScore')}</p>
            <p className="text-xs text-muted-foreground">{t(`healthCategory.${category}`)}</p>
          </div>
        </div>
        <Badge tone={CATEGORY_TONE[category]}>{score}/100</Badge>
      </div>
      {issues.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {visible.map((issue, i) => {
            const Icon = SEVERITY_ICON[issue.severity];
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', SEVERITY_COLOR[issue.severity])} aria-hidden />
                <span>{issue.message}</span>
              </li>
            );
          })}
        </ul>
      )}
      {issues.length > 3 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm text-primary underline-offset-4 hover:underline">
          {expanded ? t('showLess') : t('showAllIssues', { count: issues.length })}
        </button>
      )}
    </Card>
  );
}
