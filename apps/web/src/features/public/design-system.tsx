'use client';

import { motion } from 'framer-motion';
import { Plane } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Design system « Study in World — Premium Travel Editorial » (site public uniquement, 100% d'intensité —
 * voir la règle des trois niveaux dans le README). Composants volontairement regroupés dans un seul fichier :
 * ils sont petits, purement présentationnels et toujours utilisés ensemble sur les mêmes pages.
 */

// ---------- Reveal : apparition progressive au défilement (section 14 du brief) ----------

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Grille dont les enfants apparaissent en cascade plutôt que tous en même temps. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.4, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}

// ---------- Photos réelles des affiches Study in World (section 12 du brief : « effet postcard » et bannières) ----------
// Recadrées depuis les affiches fournies par l'agence (zone photo + titre, sans les cartes de services ni le
// pied de page déjà rendus par ailleurs en HTML). Correspondance par nom normalisé (sans accents, minuscule).

const DESTINATION_HEROES: Record<string, string> = {
  bresil: '/images/destinations/bresil-hero.jpg',
  malte: '/images/destinations/malte-hero.jpg',
  albanie: '/images/destinations/albanie-hero.jpg',
  hongrie: '/images/destinations/hongrie-hero.jpg',
  lituanie: '/images/destinations/lituanie-hero.jpg',
};

const COUNTRY_ACCENTS: Record<string, string> = {
  bresil: '#0F9D58',
  malte: '#CF142B',
  albanie: '#E41E20',
  lituanie: '#FDB913',
  hongrie: '#CE2939',
  italie: '#009246',
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

export function destinationHeroImage(countryName: string): string | null {
  return DESTINATION_HEROES[normalize(countryName)] ?? null;
}

export function countryAccentColor(countryName: string): string {
  return COUNTRY_ACCENTS[normalize(countryName)] ?? 'hsl(var(--sw-sky))';
}

// ---------- BrushTitle : grand titre avec un large trait de peinture derrière, comme sur les affiches ----------

export function BrushTitle({ children, color = 'hsl(var(--sw-sky))', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <span
        aria-hidden
        className="absolute -inset-x-2 inset-y-1 -z-10 -rotate-1 rounded-[2rem] opacity-25 blur-[1px]"
        style={{ background: color }}
      />
      {children}
    </span>
  );
}

// ---------- HandwrittenTagline : annotation manuscrite façon affiche ----------

export function HandwrittenTagline({ children, className }: { children: ReactNode; className?: string }) {
  const locale = useLocale();
  return (
    <p
      className={cn(
        'text-navy',
        locale === 'ar' ? 'text-xl font-bold italic' : 'font-handwritten text-3xl sm:text-4xl',
        className,
      )}
    >
      {children}
    </p>
  );
}

// ---------- PlaneTrail : petit avion avec une ligne de vol en pointillés ----------

export function PlaneTrail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 60" className={cn('h-10 w-24 text-primary', className)} fill="none" aria-hidden>
      <path d="M4 50 C 50 10, 90 45, 156 8" stroke="currentColor" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
      <motion.g
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, 3, 0], y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        transform="translate(140,4) rotate(-25)"
      >
        <Plane className="h-5 w-5" style={{ color: 'currentColor' }} />
      </motion.g>
    </svg>
  );
}

// ---------- StudyWorldButton : bouton principal très arrondi, ou secondaire contour bleu ----------

export function StudyWorldButton({
  href, children, variant = 'primary', accent, className,
}: { href: string; children: ReactNode; variant?: 'primary' | 'secondary'; accent?: string; className?: string }) {
  const style = accent && variant === 'primary' ? { backgroundColor: accent } : undefined;
  return (
    <Link
      href={href}
      style={style}
      className={cn(
        'group inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold transition-transform hover:-translate-y-0.5',
        variant === 'primary' ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl' : 'border-2 border-primary bg-white text-primary hover:bg-primary/5',
        className,
      )}
    >
      {children}
    </Link>
  );
}

// ---------- FlagBadge ----------

export function FlagBadge({ flag, name }: { flag?: string | null; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm font-medium text-navy shadow-sm">
      {flag && <span aria-hidden>{flag}</span>}
      {name}
    </span>
  );
}

// ---------- ServiceCard ----------

export function ServiceCard({
  icon: Icon, title, description, bullets, accent, href,
}: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; bullets: string[]; accent: string; href: string }) {
  return (
    <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Link
        href={href}
        className="group flex flex-col rounded-organic border border-border/60 bg-white p-6 shadow-[0_8px_30px_-15px_rgba(7,44,122,0.25)]"
      >
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="text-lg font-semibold text-navy">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        <ul className="mt-4 space-y-1.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2">
          → <span className="transition-all" />
        </span>
      </Link>
    </motion.div>
  );
}

// ---------- DestinationCard : reprend directement la bannière de l'affiche quand elle existe ----------

export function DestinationCard({
  name, slug, flag, tagline,
}: { name: string; slug: string; flag?: string | null; tagline: string }) {
  const hero = destinationHeroImage(name);
  const accent = countryAccentColor(name);

  return (
    <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Link href={`/destinations/${slug}`} className="group block overflow-hidden rounded-organic bg-white shadow-[0_10px_35px_-18px_rgba(7,44,122,0.35)]">
        <div className="relative aspect-[4/3] overflow-hidden">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt={name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(var(--navy)), ${accent})` }}>
              {flag && <span className="text-6xl" aria-hidden>{flag}</span>}
            </div>
          )}
        </div>
        {!hero && (
          <div className="p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-navy">
              {flag && <span aria-hidden>{flag}</span>} {name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

// ---------- PostcardCard : petite photo façon Polaroid, légèrement pivotée ----------

export function PostcardCard({ image, caption, rotate = -2 }: { image: string; caption: string; rotate?: number }) {
  return (
    <figure className="inline-block rounded-md bg-white p-2 pb-6 shadow-lg" style={{ transform: `rotate(${rotate}deg)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={caption} className="h-32 w-44 rounded-sm object-cover sm:h-40 sm:w-56" />
      <figcaption className="mt-2 text-center font-handwritten text-lg text-navy">{caption}</figcaption>
    </figure>
  );
}

// ---------- JourneyTimeline : parcours 01 → 07, ligne façon trajet d'avion ----------

export function JourneyTimeline({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <div className="relative">
      <div className="absolute left-1/2 top-6 hidden h-px w-[calc(100%-4rem)] -translate-x-1/2 border-t-2 border-dashed border-primary/30 lg:block" aria-hidden />
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.title} className="relative flex flex-col items-center text-center">
            <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary font-poppins text-lg font-bold text-white shadow-md">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="mt-3 font-semibold text-navy">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- TravelSignpost : petit panneau directionnel façon carnet de voyage ----------

export function TravelSignpost({ items }: { items: string[] }) {
  return (
    <div className="inline-flex flex-col gap-1.5 rounded-lg bg-navy p-3 text-white shadow-lg">
      {items.map((item, i) => (
        <span
          key={item}
          className="border-b border-white/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide last:border-0"
          style={{ marginInlineStart: `${(i % 3) * 6}px` }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
