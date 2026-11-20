'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, ChevronDown, Download, FileText, GraduationCap, Languages, Newspaper, Quote, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { LANDING_SERVICE_ICON_COMPONENTS } from '@/lib/landing-service-icons';
import { siteUrl } from '@/lib/site-url';
import type { Country, LandingPagePublicData, Paginated, PublicBlogPost } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAgency } from '@/features/auth/use-agency';
import { AnimatedFrame, BentoTile, BrushTitle, DestinationCard, HandwrittenTagline, JourneyTimeline, Marquee, MorphBlob, Reveal, RevealGroup, RevealItem, SectionTitle, ServiceCard, StatTile, Sticker, StudyWorldButton } from './design-system';
import { PublicShell } from './public-shell';

/** Choisit le texte arabe traduit automatiquement s'il existe, sinon retombe toujours sur le français saisi par le Super Admin. */
function pick(locale: string, fr: string | null | undefined, ar: string | null | undefined): string | null {
  const value = locale === 'ar' && ar ? ar : fr;
  return value && value.trim() ? value : null;
}

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

/**
 * Témoignages et logos partenaires viennent du CMS (page « Page d'accueil », réservée au Super Admin) —
 * voir useQuery(['public', 'landing-page']) ci-dessous. Tant qu'ils sont vides (aucun témoignage ou
 * logo réel saisi), les sections correspondantes restent masquées, comme pour le blog : on n'invente
 * jamais un avis client ou un partenariat qui n'existe pas.
 */
const SERVICES = [
  { key: 'visa', icon: GraduationCap, accent: '#064BB5' },
  { key: 'training', icon: Briefcase, accent: '#0F9D58' },
  { key: 'linguistic', icon: Languages, accent: '#39A9ED' },
  { key: 'job', icon: Briefcase, accent: '#CE2939' },
  { key: 'family', icon: Users, accent: '#F5A623' },
  { key: 'admin', icon: FileText, accent: '#072C7A' },
] as const;
const SERVICE_ACCENTS = ['#064BB5', '#0F9D58', '#39A9ED', '#CE2939', '#F5A623', '#072C7A'];
const JOURNEY_KEYS = ['profile', 'orientation', 'documents', 'application', 'admission', 'visa', 'departure'] as const;
const FAQ_KEYS = ['duration', 'countries', 'language', 'payment', 'visaRefusal', 'tracking'] as const;

export function PublicLandingPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { register, handleSubmit, reset, formState: { errors, isSubmitSuccessful } } = useForm<ContactValues>();

  const destinations = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });
  const stats = useQuery({ queryKey: ['public', 'stats'], queryFn: () => api<PublicStats>('/public/catalog/stats', { auth: false }) });
  const latestPosts = useQuery({
    queryKey: ['public', 'blog', 'latest'],
    queryFn: () => api<Paginated<PublicBlogPost>>('/public/blog', { auth: false, query: { pageSize: 3 } }),
  });
  // CMS « Page d'accueil » (Super Admin) : hero, à propos, services, FAQ, témoignages, logos partenaires.
  // Chaque section retombe sur le contenu par défaut (ci-dessus) tant que le Super Admin n'a rien saisi.
  const landingPage = useQuery({ queryKey: ['public', 'landing-page'], queryFn: () => api<LandingPagePublicData>('/public/landing-page', { auth: false }) });
  const content = landingPage.data?.content;
  const dynamicServices = landingPage.data?.services ?? [];
  const faqItems = landingPage.data?.faq ?? [];
  const testimonials = landingPage.data?.testimonials ?? [];
  const partnerLogos = landingPage.data?.partnerLogos ?? [];
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

      {/* ACCROCHE EN GRILLE BENTO — le titre, le sous-titre et l'image restent pilotés par le CMS (Super Admin),
          avec repli sur les textes par défaut ; les chiffres clés sont toujours des données réelles du catalogue. */}
      <section className="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Reveal className="col-span-2 lg:row-span-2">
            <div className="pop relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-tile bg-primary p-6 text-white sm:p-8">
              <MorphBlob className="-bottom-24 -end-20 h-80 w-80" />
              <MorphBlob className="end-1/3 top-6 h-24 w-24 [animation-duration:11s]" />
              <div className="relative">
                <Sticker>{t('heroSticker')}</Sticker>
                {(() => {
                  const heroTitle = pick(locale, content?.heroTitleFr, content?.heroTitleAr);
                  return heroTitle ? (
                    <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">{heroTitle}</h1>
                  ) : (
                    <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                      {t('heroTitleLine1')} <BrushTitle color="rgb(255 255 255 / 0.25)">{t('heroTitleHighlight')}</BrushTitle>
                    </h1>
                  );
                })()}
                <p className="mt-5 max-w-md text-lg text-white/90">{pick(locale, content?.heroSubtitleFr, content?.heroSubtitleAr) ?? t('heroSubtitle')}</p>
                <HandwrittenTagline className="mt-3 text-white">{t('taglineMain')}</HandwrittenTagline>
              </div>
              <div className="relative flex flex-wrap gap-3">
                <StudyWorldButton href="/destinations" variant="secondary">{t('ctaDestinations')}</StudyWorldButton>
                <StudyWorldButton href="/eligibility" variant="secondary" className="!bg-primary !text-white">{t('ctaEligibility')}</StudyWorldButton>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="col-span-2">
            <AnimatedFrame sticker={t('heroImageSticker')} className="h-full">
              <div className="relative aspect-[16/10] h-full min-h-56 w-full">
                {content?.heroImageUrl ? (
                  // Image hébergée par le Super Admin (domaine non connu à l'avance) : <img> plutôt que next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={content.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Image src="/images/destinations/bresil-hero.jpg" alt="" fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover object-top" />
                )}
              </div>
            </AnimatedFrame>
          </Reveal>
          {stats.data && (
            <>
              <Reveal delay={0.15}>
                <BentoTile className="h-full"><StatTile value={stats.data.countries} suffix="+" label={t('stats.countriesLabel')} /></BentoTile>
              </Reveal>
              <Reveal delay={0.2}>
                <BentoTile className="h-full"><StatTile value={stats.data.programs} suffix="+" label={t('stats.programsLabel')} /></BentoTile>
              </Reveal>
            </>
          )}
        </div>
      </section>

      {/* Bandeau défilant des destinations réelles du catalogue */}
      {!!destinations.data?.length && <Marquee items={destinations.data.map((c) => c.name)} className="mt-10" />}

      {/* PARTENAIRES — masqué tant qu'aucun logo réel n'est renseigné depuis la page « Page d'accueil ». */}
      {!!partnerLogos.length && (
        <section className="py-10">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('partnersSection.title')}</p>
            <div className="pop mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-tile bg-card px-6 py-6 grayscale">
              {partnerLogos.map((partner) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={partner.id} src={partner.logoUrl} alt={partner.name} className="h-10 w-auto object-contain opacity-70" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES — le CMS (Super Admin) prend le relais dès qu'il contient au moins un service ; sinon, repli sur l'offre par défaut. */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionTitle title={t('servicesTitle')} subtitle={t('servicesSubtitle')} />
        <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dynamicServices.length
            ? dynamicServices.map((service, i) => (
                <RevealItem key={service.id}>
                  <ServiceCard
                    icon={LANDING_SERVICE_ICON_COMPONENTS[service.iconName]}
                    accent={SERVICE_ACCENTS[i % SERVICE_ACCENTS.length] ?? '#064BB5'}
                    title={pick(locale, service.titleFr, service.titleAr) ?? service.titleFr}
                    description={pick(locale, service.descriptionFr, service.descriptionAr) ?? service.descriptionFr}
                    bullets={[]}
                    href="/eligibility"
                  />
                </RevealItem>
              ))
            : SERVICES.map(({ key, icon: Icon, accent }) => (
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
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle title={t('exploreDestinations')} subtitle={t('exploreDestinationsSubtitle')} />
            <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.data.slice(0, 6).map((c, i) => (
                <RevealItem key={c.id}>
                  <DestinationCard name={c.name} slug={c.slug} flag={c.flagEmoji} tagline={t('destinationCardFallback')} animated delay={i * 0.4} />
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
        <SectionTitle title={t('howItWorksTitle')} subtitle={t('howItWorksSubtitle')} />
        <Reveal delay={0.1} className="mt-12">
          <JourneyTimeline steps={JOURNEY_KEYS.map((key) => ({ title: t(`journey.${key}.title`), description: t(`journey.${key}.description`) }))} />
        </Reveal>
      </section>

      {/* TÉMOIGNAGES — masqué tant qu'aucun témoignage réel n'est saisi depuis la page « Page d'accueil ». */}
      {!!testimonials.length && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle title={t('testimonialsSection.title')} subtitle={t('testimonialsSection.subtitle')} />
            <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <RevealItem key={testimonial.id}>
                  <div className="pop pop-hover flex h-full flex-col rounded-tile bg-card p-6">
                    <Quote className="h-7 w-7 text-primary" aria-hidden />
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">{pick(locale, testimonial.quoteFr, testimonial.quoteAr) ?? testimonial.quoteFr}</p>
                    <p className="mt-4 font-display font-extrabold text-ink">{testimonial.name}</p>
                    {testimonial.destination && <p className="text-xs text-muted-foreground">{testimonial.destination}</p>}
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* GUIDE TÉLÉCHARGEABLE (lead magnet) — capte les visiteurs pas encore prêts à remplir le
          formulaire de contact complet. Contenu basé uniquement sur ce qui est déjà publié sur
          le site (parcours, services) ; aucun chiffre ni témoignage inventé. */}
      <section className="mx-auto max-w-6xl px-3 py-16 sm:px-6">
        <div className="pop grid items-center gap-10 rounded-tile bg-primary-soft p-6 sm:p-10 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-pop border-ink bg-primary text-white shadow-pop-sm">
              <Download className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-primary">{t('leadMagnet.eyebrow')}</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">{t('leadMagnet.title')}</h2>
            <p className="mt-3 max-w-md text-muted-foreground">{t('leadMagnet.subtitle')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            {guideUnlocked ? (
              <div className="pop rounded-tile bg-card p-6 text-center">
                <p className="font-display text-lg font-extrabold text-ink">{t('leadMagnet.success')}</p>
                <a
                  href={GUIDE_URL}
                  download
                  className="pop pop-hover mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white"
                >
                  <Download className="h-4 w-4" aria-hidden /> {t('leadMagnet.downloadButton')}
                </a>
              </div>
            ) : (
              <form
                onSubmit={leadMagnetForm.handleSubmit((v) => leadMagnetSubmit.mutate(v))}
                noValidate
                className="pop space-y-4 rounded-tile bg-card p-6"
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
                <Button type="submit" className="w-full" loading={leadMagnetSubmit.isPending}>{t('leadMagnet.cta')}</Button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* QUI SOMMES-NOUS */}
      <section className="mx-auto max-w-6xl px-3 py-16 sm:px-6">
        <div className="pop relative grid items-center gap-10 overflow-hidden rounded-tile bg-primary p-6 text-white sm:p-10 lg:grid-cols-2">
          <MorphBlob className="-bottom-24 -start-20 h-72 w-72" />
          <Reveal className="relative order-2 lg:order-1">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl border-pop border-ink bg-white text-primary shadow-pop-sm">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">{pick(locale, content?.aboutTitleFr, content?.aboutTitleAr) ?? t('aboutTitle')}</h2>
            <p className="mt-4 max-w-lg text-white/90">{pick(locale, content?.aboutTextFr, content?.aboutTextAr) ?? t('aboutText')}</p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {(['value1', 'value2', 'value3'] as const).map((v) => (
                <div key={v} className="pop rounded-xl bg-white p-3 text-center text-sm font-bold text-ink">{t(`about.${v}`)}</div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="relative order-1 lg:order-2">
            <AnimatedFrame delay={0.8}>
              <div className="relative aspect-[5/4] w-full bg-white">
                {content?.aboutImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={content.aboutImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Image src="/images/destinations/lituanie-hero.jpg" alt="" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
                )}
              </div>
            </AnimatedFrame>
          </Reveal>
        </div>
      </section>

      {/* BLOG — n'apparaît que s'il existe des articles publiés, jamais une section vide. */}
      {!!latestPosts.data?.items.length && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle title={t('blogSection.title')} subtitle={t('blogSection.subtitle')} />
            <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestPosts.data.items.map((post) => (
                <RevealItem key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="pop pop-hover group flex h-full flex-col overflow-hidden rounded-tile bg-card"
                  >
                    {post.coverImageUrl ? (
                      // Couverture hébergée par l'admin (URL dynamique, domaine non connu à l'avance) :
                      // on garde un <img> classique plutôt que next/image, qui exige de déclarer les
                      // domaines externes autorisés à l'avance.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt="" className="h-44 w-full border-b-2 border-ink object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center border-b-2 border-ink bg-primary">
                        <Newspaper className="h-8 w-8 text-white/70" aria-hidden />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <p className="font-display text-lg font-extrabold leading-snug text-ink">{post.title}</p>
                      <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
                      <p className="mt-3 text-sm font-bold text-primary">{t('blogSection.readMore')}</p>
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
        <SectionTitle title={t('faq.title')} subtitle={t('faq.subtitle')} />
        <Reveal delay={0.1} className="mt-10 space-y-3">
          {faqItems.length
            ? faqItems.map((item) => {
                const isOpen = openFaq === item.id;
                return (
                  <div key={item.id} className={`overflow-hidden rounded-xl bg-card transition-shadow ${isOpen ? 'pop' : 'pop-soft'}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start font-display font-bold text-ink"
                    >
                      {pick(locale, item.questionFr, item.questionAr) ?? item.questionFr}
                      <ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {isOpen && <p className="px-5 pb-4 text-sm text-muted-foreground">{pick(locale, item.answerFr, item.answerAr) ?? item.answerFr}</p>}
                  </div>
                );
              })
            : FAQ_KEYS.map((key) => {
                const isOpen = openFaq === key;
                return (
                  <div key={key} className={`overflow-hidden rounded-xl bg-card transition-shadow ${isOpen ? 'pop' : 'pop-soft'}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start font-display font-bold text-ink"
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
      <section id="contact" className="mx-auto max-w-md scroll-mt-28 px-4 py-16">
        <Reveal className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-pop border-ink bg-primary text-white shadow-pop-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">{t('contactTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('contactSubtitle')}</p>
        </Reveal>

        {isSubmitSuccessful && submit.isSuccess ? (
          <p role="status" className="pop mt-6 rounded-xl bg-success-soft px-4 py-3 text-center text-sm font-semibold text-success">
            {t('contactSent')}
          </p>
        ) : (
          <Reveal delay={0.1}>
            <form onSubmit={handleSubmit((v) => submit.mutate(v))} noValidate className="pop mt-6 space-y-4 rounded-tile bg-card p-6">
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
              <Button type="submit" className="w-full" loading={submit.isPending}>{t('contactSubmit')}</Button>
            </form>
          </Reveal>
        )}
      </section>
    </PublicShell>
  );
}
