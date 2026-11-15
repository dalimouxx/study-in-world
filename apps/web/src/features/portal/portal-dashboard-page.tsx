'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, FileText, Plane, Upload, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CountUp, StaggerGroup, StaggerItem } from '@/components/motion';
import { ProgressRing } from '@/components/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { candidateJourney, checklistCompletion, outstandingBalance, type StepState } from '@/lib/portal-progress';
import { portalApi } from '@/lib/portal-api';
import { cn } from '@/lib/utils';
import type { Application, Appointment, ChecklistItem, Invoice, PortalProfile, VisaFile } from '@/lib/types';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';

/** Tuile cliquable du tableau de bord (style Pop qui se soulève au survol). */
function Tile({ href, className, children }: { href: '/portal/applications' | '/portal/visa' | '/portal/appointments' | '/portal/finance'; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn('pop pop-hover flex h-full min-w-0 flex-col gap-2 rounded-tile bg-card p-4 sm:gap-3 sm:p-5', className)}>
      {children}
    </Link>
  );
}

function TileIcon({ icon: Icon }: { icon: typeof FileText }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl border-[1.5px] border-ink bg-primary-soft text-primary">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function JourneyStep({ state, index, label }: { state: StepState; index: number; label: string }) {
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-xl border-2 font-display text-base font-extrabold',
          state === 'upcoming' ? 'border-border bg-muted text-muted-foreground' : 'border-ink bg-primary text-white shadow-pop-sm',
        )}
      >
        {state === 'done' ? <Check className="h-5 w-5" aria-hidden /> : index}
        {state === 'current' && (
          // Seule boucle autorisée près de données (voir spec §8.4) : signale l'étape en cours.
          <span aria-hidden className="absolute -end-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-[1.5px] border-ink bg-white" />
          </span>
        )}
      </span>
      <span className={cn('text-xs font-semibold', state === 'upcoming' ? 'text-muted-foreground' : 'text-ink')}>{label}</span>
    </li>
  );
}

export function PortalDashboardPage() {
  const t = useTranslations('portal');
  const locale = useLocale();
  const { candidate } = usePortalAuth();

  const profile = useQuery({ queryKey: ['portal', 'profile'], queryFn: () => portalApi<PortalProfile>('/portal/profile') });
  const applications = useQuery({ queryKey: ['portal', 'applications'], queryFn: () => portalApi<Application[]>('/portal/applications') });
  const visaFiles = useQuery({ queryKey: ['portal', 'visa'], queryFn: () => portalApi<VisaFile[]>('/portal/visa-files') });
  const checklist = useQuery({ queryKey: ['portal', 'checklist'], queryFn: () => portalApi<ChecklistItem[]>('/portal/checklist') });
  const appointments = useQuery({ queryKey: ['portal', 'appointments'], queryFn: () => portalApi<Appointment[]>('/portal/appointments') });
  const invoices = useQuery({ queryKey: ['portal', 'invoices'], queryFn: () => portalApi<Invoice[]>('/portal/invoices') });

  const pendingChecklist = checklist.data?.filter((i) => i.status === 'PENDING').length ?? 0;
  const completion = checklist.data ? checklistCompletion(checklist.data) : null;
  // Parcours affiché seulement si candidatures et visas ont été chargés (sinon un « Admission en cours » serait faux).
  const journey = applications.data && visaFiles.data ? candidateJourney(applications.data, visaFiles.data) : null;
  const balance = outstandingBalance(invoices.data ?? []);
  const upcomingAppointment = appointments.data?.[0];
  const name = candidate?.firstName ?? profile.data?.firstName ?? '';

  const anyLoading = [applications, visaFiles, checklist, appointments, invoices].some((q) => q.isLoading);

  if (anyLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-56 rounded-tile col-span-2 lg:row-span-2 lg:h-auto" />
        <Skeleton className="col-span-2 h-36 rounded-tile" />
        <Skeleton className="h-36 rounded-tile" />
        <Skeleton className="h-36 rounded-tile" />
      </div>
    );
  }

  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Grand bloc bleu : accueil + complétude du dossier */}
      <StaggerItem className="col-span-2 lg:row-span-2">
        <div className="pop relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-tile bg-primary p-6 text-white">
          <div className="relative">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t('welcome', { name })}</h1>
            <p className="mt-1 text-white/85">{t('dashboardSubtitle')}</p>
          </div>
          <div className="relative flex items-center gap-4">
            <ProgressRing value={completion} label={t('completionLabel')} tone="onBlue" size={96} />
            <div>
              <p className="font-display text-xl font-extrabold">{t('completionLabel')}</p>
              <p className="text-sm text-white/85">
                {t('pendingChecklist')} : <span className="font-bold tabular-nums">{pendingChecklist}</span>
              </p>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Parcours Admission → Visa → Départ */}
      <StaggerItem className="col-span-2">
        <Link href="/portal/applications" className="pop pop-hover block h-full rounded-tile bg-card p-5">
          <p className="mb-4 font-display text-lg font-extrabold text-ink">{t('journeyTitle')}</p>
          {journey ? (
            <ol className="flex items-start gap-2">
              <JourneyStep state={journey.admission} index={1} label={t('journeyAdmission')} />
              <JourneyStep state={journey.visa} index={2} label={t('journeyVisa')} />
              <JourneyStep state={journey.departure} index={3} label={t('journeyDeparture')} />
            </ol>
          ) : (
            <p className="font-display text-xl font-extrabold text-ink">–</p>
          )}
        </Link>
      </StaggerItem>

      <StaggerItem>
        <Tile href="/portal/appointments">
          <TileIcon icon={CalendarDays} />
          <span className="text-sm text-muted-foreground">{t('nextAppointment')}</span>
          <span className="font-display text-xl font-extrabold text-ink">
            {upcomingAppointment ? new Date(upcomingAppointment.startAt).toLocaleDateString(locale) : '–'}
          </span>
        </Tile>
      </StaggerItem>

      <StaggerItem>
        <Tile href="/portal/finance">
          <TileIcon icon={Wallet} />
          <span className="text-sm text-muted-foreground">{t('outstandingTitle')}</span>
          {/* « Tout est réglé » seulement si les factures ont bien été chargées : en cas d'erreur, « – ». */}
          {invoices.isError ? (
            <span className="font-display text-xl font-extrabold text-ink">–</span>
          ) : balance.length ? (
            balance.map((b) => (
              <span key={b.currency} className="font-display text-xl font-extrabold text-ink">
                <CountUp value={b.amount} format={(n) => n.toLocaleString(locale, { maximumFractionDigits: 3 })} /> <span className="text-sm">{b.currency}</span>
              </span>
            ))
          ) : (
            <span className="font-display text-lg font-extrabold text-success sm:text-xl">{t('nothingToPay')}</span>
          )}
        </Tile>
      </StaggerItem>

      <StaggerItem>
        <Tile href="/portal/applications">
          <TileIcon icon={FileText} />
          <span className="font-display text-3xl font-extrabold text-ink">{applications.data ? <CountUp value={applications.data.length} /> : '–'}</span>
          <span className="text-sm text-muted-foreground">{t('applicationsCount')}</span>
        </Tile>
      </StaggerItem>

      <StaggerItem>
        <Tile href="/portal/visa">
          <TileIcon icon={Plane} />
          <span className="font-display text-3xl font-extrabold text-ink">{visaFiles.data ? <CountUp value={visaFiles.data.length} /> : '–'}</span>
          <span className="text-sm text-muted-foreground">{t('visaFilesCount')}</span>
        </Tile>
      </StaggerItem>

      <StaggerItem className="col-span-2">
        <Link
          href="/portal/documents"
          data-variant="primary"
          className="pop pop-hover flex h-full min-h-14 items-center justify-center gap-2 rounded-tile bg-primary px-6 py-4 font-display text-lg font-extrabold text-white"
        >
          <Upload className="h-5 w-5" aria-hidden />
          {t('uploadDocument')}
        </Link>
      </StaggerItem>
    </StaggerGroup>
  );
}
