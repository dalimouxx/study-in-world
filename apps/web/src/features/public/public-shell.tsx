'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SPRING } from '@/components/motion';
import { StudyWorldLogo } from '@/components/study-world-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { useAgency } from '@/features/auth/use-agency';
import { MorphBlob, StudyWorldButton } from './design-system';

/** Ossature commune des pages du site public — identité « Bento Pop » à pleine intensité. */
export function PublicShell({ children }: { children: ReactNode }) {
  const t = useTranslations('public');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const agency = useAgency();
  const agencyName = agency.data?.name;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: '/destinations' as const, label: t('navDestinations') },
    { href: '/programs' as const, label: t('navPrograms') },
    { href: '/eligibility' as const, label: t('navEligibility') },
    { href: '/blog' as const, label: t('navBlog') },
    { href: '/#contact' as const, label: t('navContact') },
  ];
  const whatsapp = agency.data?.whatsapp ? `https://wa.me/${agency.data.whatsapp.replace(/[^0-9]/g, '')}` : null;

  return (
    <div data-surface="public" className="min-h-screen overflow-x-clip bg-background font-sans">
      <header className="sticky top-3 z-40 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-tile border-pop border-ink bg-card shadow-pop">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <Link href="/" aria-label={agencyName ?? 'Study in World'} className="shrink-0">
              <StudyWorldLogo />
            </Link>
            <nav className="hidden items-center gap-1 text-sm font-semibold xl:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-ink/75 transition-colors hover:bg-primary-soft hover:text-primary">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <LanguageSwitcher className="hidden sm:inline-flex" />
              <Link href="/login" className="hidden h-9 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-ink/75 transition-colors hover:bg-primary-soft hover:text-primary xl:inline-flex">
                {t('employeeLogin')}
              </Link>
              <StudyWorldButton href="/eligibility" className="hidden h-9 px-4 text-xs sm:inline-flex">{t('ctaStartProject')}</StudyWorldButton>
              <button
                type="button"
                className="pop pop-hover rounded-xl bg-card p-2 xl:hidden"
                aria-label={open ? tc('close') : tn('openMenu')}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {open && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING}
                className="overflow-hidden border-t-2 border-ink xl:hidden"
              >
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} className="pop pop-hover rounded-xl bg-card px-4 py-3 font-display text-lg font-bold text-ink">
                      {l.label}
                    </Link>
                  ))}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <LanguageSwitcher />
                    <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-ink/75 hover:bg-primary-soft">{t('employeeLogin')}</Link>
                    <StudyWorldButton href="/eligibility" className="h-10 px-4 text-sm">{t('ctaStartProject')}</StudyWorldButton>
                  </div>
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 px-3 pb-6 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-tile border-pop border-ink bg-primary px-6 pb-8 pt-10 text-white shadow-pop sm:px-10">
          <MorphBlob className="-bottom-24 -end-16 h-72 w-72" />
          <MorphBlob className="end-48 top-6 h-24 w-24 [animation-duration:11s]" />
          <div className="relative grid gap-8 sm:grid-cols-3">
            <div>
              <StudyWorldLogo className="[&_span]:text-white [&_svg_.text-navy]:text-white [&_svg_.text-primary]:text-white/80" />
              <p className="mt-3 max-w-xs text-sm text-white/85">{agency.data?.footerText || t('footerTagline')}</p>
            </div>
            <div className="space-y-2 text-sm text-white/90">
              {agency.data?.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden /> {agency.data.address}</p>}
              {agency.data?.phone && <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 shrink-0" aria-hidden /> {agency.data.phone}</p>}
              {agency.data?.email && <p className="flex items-center gap-2" dir="ltr"><Mail className="h-4 w-4 shrink-0" aria-hidden /> {agency.data.email}</p>}
              {whatsapp && (
                <a href={whatsapp} className="flex items-center gap-2 underline-offset-4 hover:underline">
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden /> WhatsApp
                </a>
              )}
            </div>
            <nav className="flex flex-col gap-2 text-sm font-semibold text-white/90">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="w-fit underline-offset-4 hover:underline">{l.label}</Link>
              ))}
            </nav>
          </div>
          <div className="relative mt-10 border-t border-white/25 pt-6 text-center text-xs text-white/75">
            © {new Date().getFullYear()} {agencyName ?? 'Study in World'}
          </div>
        </div>
      </footer>

      {/* Bouton WhatsApp flottant : canal de contact le plus direct pour ce marché. Il garde la couleur de la marque
          WhatsApp (repère immédiat), avec le contour Pop ; placé côté fin de ligne pour suivre le sens de lecture. */}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('whatsappCta')}
          title={t('whatsappCta')}
          className="pop pop-hover fixed bottom-5 end-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-white"
        >
          <MessageCircle className="h-7 w-7" aria-hidden />
        </a>
      )}
    </div>
  );
}
