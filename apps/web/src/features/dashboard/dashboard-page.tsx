'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, CheckSquare, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-header';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Card } from '@/components/ui/card';
import { StatCardsSkeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Appointment, Branch, Employee, Paginated, Task } from '@/lib/types';
import { useAuth } from '@/features/auth/auth-context';
import { DeadlinesWidget } from './deadlines-widget';

/** Uniquement des chiffres réels tirés de l'API ; les indicateurs métier arriveront avec leurs modules. */
export function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user, can } = useAuth();

  const employees = useQuery({
    queryKey: ['employees', 'count'],
    queryFn: () => api<Paginated<Employee>>('/employees', { query: { pageSize: 1, status: 'ACTIVE' } }),
    enabled: can('employee.view'),
  });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches'), enabled: can('branch.view') });
  const prospects = useQuery({
    queryKey: ['prospects', 'count', 'new'],
    queryFn: () => api<Paginated<unknown>>('/prospects', { query: { pageSize: 1, status: 'NEW' } }),
    enabled: can('prospect.view'),
  });
  const candidates = useQuery({
    queryKey: ['candidates', 'count', 'active'],
    queryFn: () => api<Paginated<unknown>>('/candidates', { query: { pageSize: 1, status: 'ACTIVE' } }),
    enabled: can('candidate.view'),
  });
  const tasks = useQuery({
    queryKey: ['tasks', 'count', 'mine'],
    queryFn: () => api<Paginated<Task>>('/tasks', { query: { pageSize: 1, status: 'TODO', mine: 'true' } }),
    enabled: can('task.view'),
  });
  const appointments = useQuery({ queryKey: ['appointments', 'upcoming'], queryFn: () => api<Appointment[]>('/appointments'), enabled: can('appointment.view') });

  const upcomingAppointments = appointments.data?.filter((a) => new Date(a.endAt) >= new Date()).length;
  const anyLoading = [employees, branches, prospects, candidates, tasks, appointments].some((q) => q.isLoading && q.fetchStatus !== 'idle');

  const cards = [
    can('prospect.view') && { href: '/prospects' as const, icon: UserPlus, label: t('newProspects'), value: prospects.data?.total },
    can('candidate.view') && { href: '/candidates' as const, icon: Users, label: t('activeCandidates'), value: candidates.data?.total },
    can('task.view') && { href: '/tasks' as const, icon: CheckSquare, label: t('myOpenTasks'), value: tasks.data?.total },
    can('appointment.view') && { href: '/appointments' as const, icon: CalendarDays, label: t('upcomingAppointments'), value: upcomingAppointments },
    can('employee.view') && { href: '/employees' as const, icon: Users, label: t('activeEmployees'), value: employees.data?.total },
    can('branch.view') && { href: '/branches' as const, icon: Building2, label: t('branches'), value: branches.data?.filter((b) => b.isActive).length },
  ].filter(Boolean) as { href: '/prospects' | '/candidates' | '/tasks' | '/appointments' | '/employees' | '/branches'; icon: typeof Users; label: string; value: number | undefined }[];

  return (
    <>
      <PageHeader title={t('welcome', { name: user?.firstName ?? '' })} description={t('subtitle')} />
      {anyLoading ? (
        <div className="mb-6"><StatCardsSkeleton count={4} /></div>
      ) : cards.length > 0 ? (
        <StaggerGroup className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ href, icon: Icon, label, value }) => (
            <StaggerItem key={href}>
              <Link href={href}>
                <Card hoverable className="flex items-center gap-4 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-2xl font-semibold tabular-nums text-navy">{value ?? '–'}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </span>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <Card className="mb-6 p-6 text-sm text-muted-foreground">{t('nothingYet')}</Card>
      )}
      <DeadlinesWidget />
    </>
  );
}
