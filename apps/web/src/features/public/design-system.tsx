'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Plane } from 'lucide-react';
import type { ReactNode } from 'react';
import { CountUp, SPRING } from '@/components/motion';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Design system « Study in World — Premium Travel Editorial » (site public uniquement, 100% d'intensité —
 * voir la règle des trois niveaux dans le README). Composants volontairement regroupés dans un seul fichier :
 * ils sont petits, purement présentationnels et toujours utilisés ensemble sur les mêmes pages.
 */

// ---------- Reveal : apparition au défilement (site public), sur les primitives partagées de motion.tsx ----------

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0.001, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...SPRING, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Grille dont les enfants apparaissent en cascade plutôt que tous en même temps. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0.001, y: 16, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }} transition={SPRING} className={className}>
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

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

export function destinationHeroImage(countryName: string): string | null {
  return DESTINATION_HEROES[normalize(countryName)] ?? null;
}

/** Bento Pop : une seule couleur de marque partout — les couleurs par pays ne sont plus utilisées. */
export function countryAccentColor(_countryName: string): string {
  return 'hsl(var(--primary))';
}

// ---------- BrushTitle : surlignage bleu plat derrière le mot important ----------

export function BrushTitle({ children, color = 'hsl(var(--primary) / 0.22)', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <span aria-hidden className="absolute -inset-x-1 bottom-[0.08em] -z-10 h-[0.42em] rounded-md" style={{ background: color }} />
      {children}
    </span>
  );
}

// ---------- HandwrittenTagline : phrase d'accroche (police de titre, plus de manuscrit en Bento Pop) ----------

export function HandwrittenTagline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl', className)}>{children}</p>;
}

// ---------- PlaneTrail : petit avion avec une ligne de vol en pointillés ----------

export function PlaneTrail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 60" className={cn('h-10 w-24 text-ink', className)} fill="none" aria-hidden>
      <path d="M4 50 C 50 10, 90 45, 156 8" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
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
  // Bento Pop : une seule couleur de marque, l'accent par pays n'est plus appliqué (prop gardée pour compatibilité).
  void accent;
  const style = undefined;
  return (
    <Link
      href={href}
      style={style}
      data-variant={variant}
      className={cn(
        'pop pop-hover group inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-xl px-6 text-sm font-bold',
        variant === 'primary' ? 'bg-primary text-white' : 'bg-card text-ink',
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
    <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-white px-3 py-1 text-sm font-bold text-ink shadow-pop-sm">
      {flag && <span aria-hidden>{flag}</span>}
      {name}
    </span>
  );
}

// ---------- ServiceCard ----------

export function ServiceCard({
  icon: Icon, title, description, bullets, accent: _accent, href,
}: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; bullets: string[]; accent: string; href: string }) {
  return (
    <Link href={href} className="pop pop-hover group flex h-full flex-col rounded-tile bg-card p-6">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-pop border-ink bg-primary text-white shadow-pop-sm transition-transform duration-300 group-hover:-rotate-6">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="font-display text-xl font-extrabold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[3px] border border-ink bg-primary" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary transition-all group-hover:gap-2" aria-hidden>
        <span className="rtl:rotate-180">→</span>
      </span>
    </Link>
  );
}

// ---------- DestinationCard : reprend directement la bannière de l'affiche quand elle existe ----------

export function DestinationCard({
  name, slug, flag, tagline,
}: { name: string; slug: string; flag?: string | null; tagline: string }) {
  const hero = destinationHeroImage(name);

  return (
    <Link href={`/destinations/${slug}`} className="pop pop-hover group block overflow-hidden rounded-tile bg-card">
      <div className="relative aspect-[4/3] overflow-hidden">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary">
            <MorphBlob className="-bottom-10 -end-10 h-40 w-40" />
            {flag && <span className="relative text-6xl" aria-hidden>{flag}</span>}
          </div>
        )}
      </div>
      {!hero && (
        <div className="border-t-2 border-ink p-5">
          <p className="flex items-center gap-2 font-display text-xl font-extrabold text-ink">
            {flag && <span aria-hidden>{flag}</span>} {name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
        </div>
      )}
    </Link>
  );
}

// ---------- PostcardCard : petite photo façon Polaroid, légèrement pivotée ----------

export function PostcardCard({ image, caption, rotate = -2 }: { image: string; caption: string; rotate?: number }) {
  return (
    <figure className="pop inline-block rounded-xl bg-white p-2 pb-4" style={{ transform: `rotate(${rotate}deg)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={caption} className="h-32 w-44 rounded-lg border-[1.5px] border-ink object-cover sm:h-40 sm:w-56" />
      <figcaption className="mt-2 text-center font-display text-base font-bold text-ink">{caption}</figcaption>
    </figure>
  );
}

// ---------- JourneyTimeline : parcours en tuiles numérotées (l'ordre est l'information) ----------

export function JourneyTimeline({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => (
        <RevealItem key={step.title}>
          <div className="pop pop-hover h-full rounded-tile bg-card p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border-pop border-ink bg-primary font-display text-lg font-extrabold text-white shadow-pop-sm">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="mt-4 font-display text-lg font-extrabold tracking-tight text-ink">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </div>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}

// ---------- TravelSignpost : liste de puces Pop légèrement décalées ----------

export function TravelSignpost({ items }: { items: string[] }) {
  return (
    <div className="inline-flex flex-col items-start gap-2">
      {items.map((item, i) => (
        <span
          key={item}
          className="pop rounded-xl bg-card px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide text-ink"
          style={{ marginInlineStart: `${(i % 3) * 10}px`, transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ---------- MorphBlob : forme translucide qui se déforme lentement (fonds des grands blocs bleus) ----------

export function MorphBlob({ className }: { className?: string }) {
  return <span aria-hidden className={cn('pointer-events-none absolute block animate-morph bg-white/15', className)} />;
}

// ---------- Briques Bento ----------

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>;
}

export function BentoTile({
  children, className, tone = 'white', span = 1,
}: { children: ReactNode; className?: string; tone?: 'white' | 'blue'; span?: 1 | 2 }) {
  return (
    <div
      className={cn(
        'pop pop-hover relative overflow-hidden rounded-tile p-5',
        tone === 'blue' ? 'bg-primary text-white' : 'bg-card text-ink',
        span === 2 && 'lg:col-span-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Gros chiffre qui défile jusqu'à sa valeur, avec son libellé. */
export function StatTile({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
  return (
    <div>
      <p className="font-display text-5xl font-extrabold leading-none tracking-tight text-primary">
        <CountUp value={value} />
        {suffix}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Pastille « autocollant » penchée qui gigote (site public uniquement). */
export function Sticker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('pop inline-block animate-wiggle rounded-full bg-card px-3 py-1 text-xs font-extrabold text-ink', className)}>
      {children}
    </span>
  );
}

/** Bandeau défilant (contenu doublé pour une boucle sans saut), en pause au survol. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={cn('group overflow-hidden border-y-2 border-ink bg-card py-3', className)}>
      <div className="flex w-max animate-marquee gap-8 group-hover:[animation-play-state:paused] rtl:[animation-direction:reverse]">
        {row.map((item, i) => (
          <span key={i} aria-hidden={i >= items.length} className="flex items-center gap-8 font-display text-lg font-extrabold text-ink">
            {item}
            <span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-ink bg-primary" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
