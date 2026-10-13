'use client';

import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { StudyWorldLogo } from '@/components/study-world-logo';
import { Link } from '@/i18n/navigation';
import { useAgency } from '@/features/auth/use-agency';
import { StudyWorldButton } from './design-system';

/** Ossature commune (en-tête + pied de page) des pages du site public — identité « Premium Travel Editorial ». */
export function PublicShell({ children }: { children: ReactNode }) {
  const t = useTranslations('public');
  const agency = useAgency();
  const agencyName = agency.data?.name;

  return (
    <div className="min-h-screen bg-sw-bg-light font-sans">
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/" aria-label={agencyName ?? 'Study in World'}>
            <StudyWorldLogo />
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/destinations" className="text-navy/70 hover:text-primary">{t('navDestinations')}</Link>
            <Link href="/programs" className="text-navy/70 hover:text-primary">{t('navPrograms')}</Link>
            <Link href="/eligibility" className="text-navy/70 hover:text-primary">{t('navEligibility')}</Link>
            <Link href="/blog" className="text-navy/70 hover:text-primary">{t('navBlog')}</Link>
            <Link href="/#contact" className="text-navy/70 hover:text-primary">{t('navContact')}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/login" className="inline-flex h-9 items-center rounded-full border border-primary/30 px-4 text-sm font-medium text-primary hover:bg-primary/5">
              {t('employeeLogin')}
            </Link>
            <StudyWorldButton href="/eligibility" className="hidden h-9 px-4 text-xs sm:inline-flex">{t('ctaStartProject')}</StudyWorldButton>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="relative mt-16 overflow-hidden bg-navy pt-14 text-white">
        <svg viewBox="0 0 1440 60" className="absolute -top-px left-0 w-full text-sw-bg-light" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0 40 C 360 0, 1080 80, 1440 20 L1440 0 L0 0 Z" />
        </svg>
        <div className="mx-auto max-w-6xl px-6 pb-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <StudyWorldLogo className="[&_span]:text-white [&_svg]:text-sw-sky" />
              <p className="mt-3 max-w-xs text-sm text-white/70">{t('footerTagline')}</p>
            </div>
            <div className="space-y-2 text-sm text-white/80">
              {agency.data?.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-sw-sky" aria-hidden /> {agency.data.address}</p>}
              {agency.data?.phone && <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 shrink-0 text-sw-sky" aria-hidden /> {agency.data.phone}</p>}
              {agency.data?.email && <p className="flex items-center gap-2" dir="ltr"><Mail className="h-4 w-4 shrink-0 text-sw-sky" aria-hidden /> {agency.data.email}</p>}
              {agency.data?.whatsapp && (
                <a href={`https://wa.me/${agency.data.whatsapp.replace(/[^0-9]/g, '')}`} className="flex items-center gap-2 hover:text-sw-sky">
                  <MessageCircle className="h-4 w-4 shrink-0 text-sw-sky" aria-hidden /> WhatsApp
                </a>
              )}
            </div>
            <nav className="flex flex-col gap-2 text-sm text-white/80">
              <Link href="/destinations" className="hover:text-sw-sky">{t('navDestinations')}</Link>
              <Link href="/programs" className="hover:text-sw-sky">{t('navPrograms')}</Link>
              <Link href="/eligibility" className="hover:text-sw-sky">{t('navEligibility')}</Link>
              <Link href="/blog" className="hover:text-sw-sky">{t('navBlog')}</Link>
              <Link href="/#contact" className="hover:text-sw-sky">{t('navContact')}</Link>
            </nav>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50">
            © {new Date().getFullYear()} {agencyName ?? 'Study in World'}
          </div>
        </div>
      </footer>
    </div>
  );
}
