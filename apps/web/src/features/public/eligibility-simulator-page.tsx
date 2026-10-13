'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Country, Paginated, Program, ProgramLevel } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { Reveal, RevealGroup, RevealItem } from './design-system';
import { PublicShell } from './public-shell';

const LEVELS: ProgramLevel[] = ['LICENCE', 'MASTER', 'DOCTORAT', 'FOUNDATION', 'PREPA', 'FORMATION_PRO', 'FORMATION_PRIVEE', 'FORMATION_PUBLIQUE', 'SEJOUR_LINGUISTIQUE', 'COURS_DE_LANGUE', 'CERTIFICAT'];

interface Criteria {
  countryId: string;
  level: string;
  maxBudget: string;
  ielts: string;
}

interface LeadValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export function EligibilitySimulatorPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);

  const { register: registerCriteria, handleSubmit: handleCriteriaSubmit } = useForm<Criteria>({
    defaultValues: { countryId: '', level: '', maxBudget: '', ielts: '' },
  });
  const { register: registerLead, handleSubmit: handleLeadSubmit, formState: { errors, isSubmitSuccessful } } = useForm<LeadValues>();

  const countries = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });

  const results = useQuery({
    queryKey: ['public', 'eligibility', criteria],
    queryFn: () =>
      api<Paginated<Program>>('/public/catalog/programs', {
        auth: false,
        query: { pageSize: 6, countryId: criteria!.countryId || undefined, level: criteria!.level || undefined, maxBudget: criteria!.maxBudget || undefined, ielts: criteria!.ielts || undefined },
      }),
    enabled: !!criteria,
  });

  const submitLead = useMutation({
    mutationFn: (v: LeadValues) =>
      api('/public/leads', {
        method: 'POST',
        body: {
          ...v,
          email: v.email || undefined,
          desiredCountryId: criteria?.countryId || undefined,
          desiredProgram: criteria?.level ? t(`levels.${criteria.level}`) : undefined,
          budget: criteria?.maxBudget ? Number(criteria.maxBudget) : undefined,
          campaign: 'simulateur-eligibilite',
        },
      }),
    onSuccess: () => toast.success(t('contactSent')),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = results.data?.items ?? [];

  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-6 py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-3 font-poppins text-3xl font-bold text-navy">{t('eligibilityTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('eligibilitySubtitle')}</p>
        </Reveal>

        <Reveal delay={0.1}>
          <form
            onSubmit={handleCriteriaSubmit((v) => setCriteria(v))}
            className="mx-auto mt-8 grid max-w-2xl gap-4 rounded-organic border border-primary/10 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <Field label={t('desiredDestination')} htmlFor="sim-country">
              <Select id="sim-country" {...registerCriteria('countryId')}>
                <option value="">{t('allCountries')}</option>
                {(countries.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.flagEmoji} {c.name}</option>)}
              </Select>
            </Field>
            <Field label={t('level')} htmlFor="sim-level">
              <Select id="sim-level" {...registerCriteria('level')}>
                <option value="">{t('allLevels')}</option>
                {LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('yourBudget')} htmlFor="sim-budget" hint={t('budgetHint')}>
              <Input id="sim-budget" type="number" dir="ltr" {...registerCriteria('maxBudget')} />
            </Field>
            <Field label={t('yourIelts')} htmlFor="sim-ielts" hint={t('ieltsHint')}>
              <Input id="sim-ielts" type="number" step={0.5} min={0} max={9} dir="ltr" {...registerCriteria('ielts')} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full !rounded-full">{t('seeMyOptions')}</Button>
            </div>
          </form>
        </Reveal>

        {criteria && (
          <div className="mx-auto mt-10 max-w-3xl">
            {results.isLoading ? (
              <p role="status" className="text-center text-sm text-muted-foreground">{tc('loading')}</p>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t('noEligibleResults')}</p>
            ) : (
              <>
                <Reveal><h2 className="mb-4 text-center font-poppins text-lg font-bold text-navy">{t('eligibleResultsTitle', { count: results.data?.total ?? items.length })}</h2></Reveal>
                <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <RevealItem key={p.id}>
                      <div className="rounded-organic border border-primary/10 bg-white p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">{p.university?.country?.flagEmoji} {p.university?.name}</p>
                        <Link href={`/programs/${p.slug}`} className="mt-1 block font-medium text-navy hover:text-primary">{p.name}</Link>
                        <p className="mt-1 text-sm text-muted-foreground">{t(`levels.${p.level}`)}{p.tuitionFees ? ` · ${p.tuitionFees} ${p.currency}` : ''}</p>
                      </div>
                    </RevealItem>
                  ))}
                </RevealGroup>
              </>
            )}

            <Reveal delay={0.1} className="mt-8 rounded-organic border border-primary/10 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">{t('eligibilityDisclaimer')}</p>
              {!leadOpen && !isSubmitSuccessful && (
                <Button className="mt-4 !rounded-full" onClick={() => setLeadOpen(true)}>{t('getPersonalizedHelp')}</Button>
              )}
              {isSubmitSuccessful ? (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('contactSent')}</p>
              ) : leadOpen && (
                <form onSubmit={handleLeadSubmit((v) => submitLead.mutate(v))} noValidate className="mx-auto mt-4 grid max-w-md gap-3 text-left sm:grid-cols-2">
                  <Field label={t('firstName')} htmlFor="lead-first" error={errors.firstName?.message}>
                    <Input id="lead-first" {...registerLead('firstName', { required: tc('required') })} />
                  </Field>
                  <Field label={t('lastName')} htmlFor="lead-last" error={errors.lastName?.message}>
                    <Input id="lead-last" {...registerLead('lastName', { required: tc('required') })} />
                  </Field>
                  <Field label={t('phone')} htmlFor="lead-phone" error={errors.phone?.message}>
                    <Input id="lead-phone" dir="ltr" {...registerLead('phone', { required: tc('required') })} />
                  </Field>
                  <Field label={t('email')} htmlFor="lead-email">
                    <Input id="lead-email" type="email" dir="ltr" {...registerLead('email')} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Button type="submit" className="w-full !rounded-full" loading={submitLead.isPending}>{t('contactSubmit')}</Button>
                  </div>
                </form>
              )}
            </Reveal>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
