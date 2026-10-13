'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckSquare, FileText, Plane } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { StatCardsSkeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { portalApi } from '@/lib/portal-api';
import type { Application, Appointment, ChecklistItem, PortalProfile, VisaFile } from '@/lib/types';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';

const CARD_ACCENTS = ['#064BB5', '#39A9ED', '#0F9D58', '#F5A623'];

export function PortalDashboardPage() {
  const t = useTranslations('portal');
  const { candidate } = usePortalAuth();

  const profile = useQuery({ queryKey: ['portal', 'profile'], queryFn: () => portalApi<PortalProfile>('/portal/profile') });
  const applications = useQuery({ queryKey: ['portal', 'applications'], queryFn: () => portalApi<Application[]>('/portal/applications') });
  const visaFiles = useQuery({ queryKey: ['portal', 'visa'], queryFn: () => portalApi<VisaFile[]>('/portal/visa-files') });
  const checklist = useQuery({ queryKey: ['portal', 'checklist'], queryFn: () => portalApi<ChecklistItem[]>('/portal/checklist') });
  const appointments = useQuery({ queryKey: ['portal', 'appointments'], queryFn: () => portalApi<Appointment[]>('/portal/appointments') });

  const pendingChecklist = checklist.data?.filter((i) => i.status === 'PENDING').length ?? 0;
  const upcomingAppointment = appointments.data?.[0];

  const cards = [
    { href: '/portal/applications' as const, icon: FileText, label: t('applicationsCount'), value: applications.data?.length },
    { href: '/portal/visa' as const, icon: Plane, label: t('visaFilesCount'), value: visaFiles.data?.length },
    { href: '/portal/documents' as const, icon: CheckSquare, label: t('pendingChecklist'), value: pendingChecklist },
    { href: '/portal/appointments' as const, icon: CalendarDays, label: t('nextAppointment'), value: upcomingAppointment ? new Date(upcomingAppointment.startAt).toLocaleDateString() : '–' },
  ];

  const anyLoading = [applications, visaFiles, checklist, appointments].some((q) => q.isLoading);

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('welcome', { name: candidate?.firstName ?? profile.data?.firstName ?? '' })}</h1>
      <p className="mt-1 text-muted-foreground">{t('dashboardSubtitle')}</p>

      {anyLoading ? (
        <div className="mt-6"><StatCardsSkeleton count={4} /></div>
      ) : (
        <StaggerGroup className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ href, icon: Icon, label, value }, i) => (
            <StaggerItem key={href}>
              <Link href={href}>
                <Card hoverable className="flex items-center gap-4 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: CARD_ACCENTS[i % CARD_ACCENTS.length] }}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xl font-semibold text-navy">{value ?? '–'}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </span>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </>
  );
}
