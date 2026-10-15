'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, ChevronDown, Download, FileText, GraduationCap, Languages, Newspaper, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { siteUrl } from '@/lib/site-url';
import type { Country, Paginated, PublicBlogPost } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAgency } from '@/features/auth/use-agency';
import { BrushTitle, DestinationCard, HandwrittenTagline, JourneyTimeline, PlaneTrail, Reveal, RevealGroup, RevealItem, ServiceCard, StudyWorldButton } from './design-system';
import { PublicShell } from './public-shell';

interface ContactValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string;
}

interface PublicStats {
  countries: number;
  universities: number;
  programs: number;
}

interface LeadMagnetValues {
  firstName: string;
  lastName: string;
  phone: string;
}

const GUIDE_URL = '/guides/guide-etudes-etranger.pdf';

const SERVICES = [
  { key: 'visa', icon: GraduationCap, accent: '#064BB5' },
  { key: 'training', icon: Briefcase, accent: '#0F9D58' },
  { key: 'linguistic', icon: Languages, accent: '#39A9ED' },
  { key: 'job', icon: Briefcase, accent: '#CE2939' },
  { key: 'family', icon: Users, accent: '#F5A623' },
  { key: 'admin', icon: FileText, accent: '#072C7A' },
] as const;
const JOURNEY_KEYS = ['profile', 'orientation', 'documents', 'application', 'admission', 'visa', 'departure'] as const;
const FAQ_KEYS = ['duration', 'countries', 'language', 'payment', 'visaRefusal', 'tracking'] as const;

export function PublicLandingPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { register, handleSubmit, reset, formState: { errors, isSubmitSuccessful } } = useForm<ContactValues>();

  const destinations = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });
  const stats = useQuery({ queryKey: ['public', 'stats'], queryFn: () => api<PublicStats>('/public/catalog/stats', { auth: false }) });
  const latestPosts = useQuery({
    queryKey: ['public', 'blog', 'latest'],
    queryFn: () => api<Paginated<PublicBlogPost>>('/public/blog', { auth: false, query: { pageSize: 3 } }),
  });
  const agency = useAgency();
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ_KEYS[0]);
  const [guideUnlocked, setGuideUnlocked] = useState(false);

  const submit = useMutation({
    mutationFn: (v: ContactValues) => api('/public/leads', { method: 'POST', body: { ...v, email: v.email || undefined, message: v.message || undefined }, auth: false }),
    onSuccess: () => { toast.success(t('contactSent')); reset(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const leadMagnetForm = useForm<LeadMagnetValues>();
  // Pas d'envoi par e-mail (le SMTP n'est pas garanti configuré) : on capte le lead comme pour le
  // formulaire de contact, puis on débloque immédiatement le téléchargement direct du PDF.
  const leadMagnetSubmit = useMutation({
    mutationFn: (v: LeadMagnetValues) => api('/public/leads', { method: 'POST', body: { ...v, campaign: 'guide-telechargement' }, auth: false }),
    onSuccess: () => setGuideUnlocked(true),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <PublicShell>
      {agency.data?.name && (
        // Organisation (schema.org), une seule fois sur la page d'accueil : uniquement des champs réels
        // (nom, logo, URL) — jamais d'adresse ou de téléphone inventés pour « faire complet ».
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: agency.data.name,
              url: siteUrl(),
              ...(agency.data.logoUrl ? { logo: agency.data.logoUrl } : {}),
              ...(agency.data.address ? { address: { '@type': 'PostalAddress', streetAddress: agency.data.address } } : {}),
              ...(agency.data.phone || agency.data.email
                ? { contactPoint: { '@type': 'ContactPoint', ...(agency.data.phone ? { telephone: agency.data.phone } : {}), ...(agency.data.email ? { email: agency.data.email } : {}), contactType: 'customer service' } }
                : {}),
            }),
          }}
        />
      )}

      {/* HERO */}
      <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
          <Reveal>
            <PlaneTrail />
            <h1 className="mt-3 font-poppins text-4xl font-bold leading-[1.1] text-navy sm:text-5xl">
              {t('heroTitleLine1')} <BrushTitle color="hsl(var(--sw-sky))">{t('heroTitleHighlight')}</BrushTitle>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">{t('heroSubtitle')}</p>
            <HandwrittenTagline className="mt-4">{t('taglineMain')}</HandwrittenTagline>
            <div className="mt-8 flex flex-wrap gap-3">
              <StudyWorldButton href="/destinations">{t('ctaDestinations')}</StudyWorldButton>
              <StudyWorldButton href="/eligibility" variant="secondary">{t('ctaEligibility')}</StudyWorldButton>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="relative">
            <div className="absolute -inset-4 -z-10 rounded-organic bg-sw-sky/20" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden rounded-organic shadow-2xl sm:aspect-[5/6]">
              <Image
                src="/images/destinations/bresil-hero.jpg"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 480px, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CHIFFRES CLÉS — toujours des données réelles du catalogue, jamais de chiffres inventés. */}
      {stats.data && (
        <section className="border-y border-primary/10 bg-white py-10">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 text-center sm:grid-cols-3">
            {([
              ['countries', stats.data.countries],
              ['universities', stats.data.universities],
              ['programs', stats.data.programs],
            ] as const).map(([key, value]) => (
              <div key={key}>
                <p className="font-poppins text-4xl font-bold text-primary">{value}+</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`stats.${key}Label`)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-poppins text-3xl font-bold text-navy">{t('servicesTitle')}</h2>
          <p className="mt-2 text-muted-foreground">{t('servicesSubtitle')}</p>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ key, icon: Icon, accent }) => (
            <RevealItem key={key}>
              <ServiceCard
                icon={Icon}
                accent={accent}
                title={t(`services.${key}.title`)}
                description={t(`services.${key}.description`)}
                bullets={[t(`services.${key}.bullet1`), t(`services.${key}.bullet2`)]}
                href="/eligibility"
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* DESTINATIONS */}
      {!!destinations.data?.length && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-poppins text-3xl font-bold text-navy">{t('exploreDestinations')}</h2>
              <p className="mt-2 text-muted-foreground">{t('exploreDestinationsSubtitle')}</p>
            </Reveal>
            <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.data.slice(0, 6).map((c) => (
                <RevealItem key={c.id}>
                  <DestinationCard name={c.name} slug={c.slug} flag={c.flagEmoji} tagline={t('destinationCardFallback')} />
                </RevealItem>
              ))}
            </RevealGroup>
            <div className="mt-10 text-center">
              <StudyWorldButton href="/destinations" variant="secondary">{t('ctaDestinations')}</StudyWorldButton>
            </div>
          </div>
        </section>
      )}

      {/* COMMENT ÇA MARCHE */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-poppins text-3xl font-bold text-navy">{t('howItWorksTitle')}</h2>
          <p className="mt-2 text-muted-foreground">{t('howItWorksSubtitle')}</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-12">
          <JourneyTimeline steps={JOURNEY_KEYS.map((key) => ({ title: t(`journey.${key}.title`), description: t(`journey.${key}.description`) }))} />
        </Reveal>
      </section>

      {/* GUIDE TÉLÉCHARGEABLE (lead magnet) — capte les visiteurs pas encore prêts à remplir le
          formulaire de contact complet. Contenu basé uniquement sur ce qui est déjà publié sur
          le site (parcours, services) ; aucun chiffre ni témoignage inventé. */}
      <section className="bg-sw-sky/10 py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Download className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-primary">{t('leadMagnet.eyebrow')}</p>
            <h2 className="mt-2 font-poppins text-3xl font-bold text-navy">{t('leadMagnet.title')}</h2>
            <p className="mt-3 max-w-md text-muted-foreground">{t('leadMagnet.subtitle')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            {guideUnlocked ? (
              <div className="rounded-organic border border-primary/10 bg-white p-6 text-center shadow-[0_8px_30px_-15px_rgba(7,44,122,0.2)]">
                <p className="font-poppins font-semibold text-navy">{t('leadMagnet.success')}</p>
                <a
                  href={GUIDE_URL}
                  download
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" aria-hidden /> {t('leadMagnet.downloadButton')}
                </a>
              </div>
            ) : (
              <form
                onSubmit={leadMagnetForm.handleSubmit((v) => leadMagnetSubmit.mutate(v))}
                noValidate
                className="space-y-4 rounded-organic border border-primary/10 bg-white p-6 shadow-[0_8px_30px_-15px_rgba(7,44,122,0.2)]"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('firstName')} htmlFor="guide-first" error={leadMagnetForm.formState.errors.firstName?.message}>
                    <Input id="guide-first" aria-invalid={!!leadMagnetForm.formState.errors.firstName} {...leadMagnetForm.register('firstName', { required: tc('required') })} />
                  </Field>
                  <Field label={t('lastName')} htmlFor="guide-last" error={leadMagnetForm.formState.errors.lastName?.message}>
                    <Input id="guide-last" aria-invalid={!!leadMagnetForm.formState.errors.lastName} {...leadMagnetForm.register('lastName', { required: tc('required') })} />
                  </Field>
                </div>
                <Field label={t('phone')} htmlFor="guide-phone" error={leadMagnetForm.formState.errors.phone?.message}>
                  <Input id="guide-phone" dir="ltr" aria-invalid={!!leadMagnetForm.formState.errors.phone} {...leadMagnetForm.register('phone', { required: tc('required') })} />
                </Field>
                <Button type="submit" className="w-full !rounded-full" loading={leadMagnetSubmit.isPending}>{t('leadMagnet.cta')}</Button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* QUI SOMMES-NOUS */}
      <section className="bg-navy py-16 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <Users className="h-6 w-6 text-sw-sky" aria-hidden />
            </span>
            <h2 className="mt-4 font-poppins text-3xl font-bold">{t('aboutTitle')}</h2>
            <p className="mt-4 max-w-lg text-white/80">{t('aboutText')}</p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {(['value1', 'value2', 'value3'] as const).map((v) => (
                <div key={v} className="rounded-xl bg-white/5 p-3 text-center text-sm font-medium">{t(`about.${v}`)}</div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="relative order-1 aspect-[5/4] overflow-hidden rounded-organic shadow-2xl lg:order-2">
            <Image
              src="/images/destinations/lituanie-hero.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      {/* BLOG — n'apparaît que s'il existe des articles publiés, jamais une section vide. */}
      {!!latestPosts.data?.items.length && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-poppins text-3xl font-bold text-navy">{t('blogSection.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('blogSection.subtitle')}</p>
            </Reveal>
            <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestPosts.data.items.map((post) => (
                <RevealItem key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-organic bg-white shadow-[0_10px_35px_-18px_rgba(7,44,122,0.35)] transition-transform hover:-translate-y-1"
                  >
                    {post.coverImageUrl ? (
                      // Couverture hébergée par l'admin (URL dynamique, domaine non connu à l'avance) :
                      // on garde un <img> classique plutôt que next/image, qui exige de déclarer les
                      // domaines externes autorisés à l'avance.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt="" className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-navy to-primary">
                        <Newspaper className="h-8 w-8 text-white/70" aria-hidden />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <p className="font-poppins font-semibold text-navy">{post.title}</p>
                      <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
                      <p className="mt-3 text-xs font-medium text-primary">{t('blogSection.readMore')}</p>
                    </div>
                  </Link>
                </RevealItem>
              ))}
            </RevealGroup>
            <div className="mt-10 text-center">
              <StudyWorldButton href="/blog" variant="secondary">{t('blogSection.seeAll')}</StudyWorldButton>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <Reveal className="text-center">
          <h2 className="font-poppins text-3xl font-bold text-navy">{t('faq.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('faq.subtitle')}</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 space-y-3">
          {FAQ_KEYS.map((key) => {
            const isOpen = openFaq === key;
            return (
              <div key={key} className="overflow-hidden rounded-organic border border-primary/10 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-poppins font-medium text-navy"
                >
                  {t(`faq.items.${key}.question`)}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isOpen && <p className="px-5 pb-4 text-sm text-muted-foreground">{t(`faq.items.${key}.answer`)}</p>}
              </div>
            );
          })}
        </Reveal>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-md px-6 py-16">
        <Reveal className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-3 font-poppins text-2xl font-bold text-navy">{t('contactTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('contactSubtitle')}</p>
        </Reveal>

        {isSubmitSuccessful && submit.isSuccess ? (
          <p role="status" className="mt-6 rounded-organic border border-success/40 bg-success-soft px-4 py-3 text-center text-sm text-success">
            {t('contactSent')}
          </p>
        ) : (
          <Reveal delay={0.1}>
            <form onSubmit={handleSubmit((v) => submit.mutate(v))} noValidate className="mt-6 space-y-4 rounded-organic border border-primary/10 bg-white p-6 shadow-[0_8px_30px_-15px_rgba(7,44,122,0.2)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('firstName')} htmlFor="pub-first" error={errors.firstName?.message}>
                  <Input id="pub-first" aria-invalid={!!errors.firstName} {...register('firstName', { required: tc('required') })} />
                </Field>
                <Field label={t('lastName')} htmlFor="pub-last" error={errors.lastName?.message}>
                  <Input id="pub-last" aria-invalid={!!errors.lastName} {...register('lastName', { required: tc('required') })} />
                </Field>
              </div>
              <Field label={t('phone')} htmlFor="pub-phone" error={errors.phone?.message}>
                <Input id="pub-phone" dir="ltr" aria-invalid={!!errors.phone} {...register('phone', { required: tc('required') })} />
              </Field>
              <Field label={t('email')} htmlFor="pub-email">
                <Input id="pub-email" type="email" dir="ltr" {...register('email')} />
              </Field>
              <Field label={t('message')} htmlFor="pub-message">
                <Textarea id="pub-message" rows={3} {...register('message')} />
              </Field>
              <Button type="submit" className="w-full !rounded-full" loading={submit.isPending}>{t('contactSubmit')}</Button>
            </form>
          </Reveal>
        )}
      </section>
    </PublicShell>
  );
}
