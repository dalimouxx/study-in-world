import { cn } from '@/lib/utils';

/**
 * Recomposition fidèle du logo des affiches Study in World (chapeau de diplômé posé sur un globe stylisé,
 * "Study" + un badge bleu "in" + "World") — en SVG/texte plutôt qu'une image recadrée depuis une affiche :
 * ça reste net à toute taille et sans artefact de fond, ce qu'un recadrage raster ne peut pas garantir.
 */
export function StudyWorldLogo({ tagline = false, className }: { tagline?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span className="inline-flex items-center gap-1.5 font-poppins font-semibold leading-none">
        <GlobeCapMark className="h-7 w-7 shrink-0" />
        <span className="text-navy">Study</span>
        <span className="rounded-md bg-primary px-1.5 py-0.5 text-white">in</span>
        <span className="text-navy">World</span>
      </span>
      {tagline && <span className="mt-0.5 text-[11px] font-medium text-navy/70">Bureau de consulting &amp; préparation dossiers de visa</span>}
    </span>
  );
}

function GlobeCapMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="20" cy="23" r="12" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <path d="M8 23h24M20 11c4 3 4 21 0 24M20 11c-4 3-4 21 0 24" stroke="currentColor" strokeWidth="1.4" className="text-primary" />
      <path
        d="M20 2 3 9l17 7 17-7-17-7Z"
        fill="currentColor"
        className="text-navy"
      />
      <path d="M11 12.3V19c0 2 4 4.5 9 4.5s9-2.5 9-4.5v-6.7" stroke="currentColor" strokeWidth="1.6" className="text-navy" fill="none" />
      <path d="M35 9.5v5" stroke="currentColor" strokeWidth="1.6" className="text-navy" strokeLinecap="round" />
      <circle cx="35" cy="16" r="1.4" fill="currentColor" className="text-navy" />
    </svg>
  );
}
