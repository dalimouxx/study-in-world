'use client';

import { useTranslations } from 'next-intl';
import { useAgency } from '@/features/auth/use-agency';
import { cn } from '@/lib/utils';
import { StudyWorldLogo } from './study-world-logo';

/**
 * Écran de chargement Bento Pop (choix du propriétaire : « Logo qui saute ») : logo de l'agence — celui déposé
 * dans les Paramètres s'il existe, sinon le logo Study in World dont le badge « in » saute — et une barre Pop
 * qui se remplit. Il n'apparaît qu'après 150 ms pour ne pas clignoter sur les chargements très rapides.
 */
export function PageLoader({ fullscreen = true }: { fullscreen?: boolean }) {
  const t = useTranslations('common');
  const agency = useAgency();
  const logoUrl = agency.data?.logoUrl;

  return (
    <div
      role="status"
      data-page-loader
      className={cn(
        'flex flex-col items-center justify-center gap-5 bg-background opacity-0 [animation:fade-in_200ms_ease-out_150ms_forwards]',
        fullscreen ? 'fixed inset-0 z-[60]' : 'min-h-[50vh]',
      )}
    >
      {logoUrl ? (
        // Logo hébergé par l'agence (domaine inconnu à l'avance) : <img> plutôt que next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={agency.data?.name ?? ''} className="h-12 w-auto animate-hop object-contain" />
      ) : (
        <span data-logo className="text-2xl">
          <StudyWorldLogo animated />
        </span>
      )}
      <span aria-hidden className="block h-3.5 w-44 overflow-hidden rounded-full border-2 border-ink bg-card shadow-pop-sm">
        <span className="block h-full w-full origin-left animate-loader-fill border-e-2 border-ink bg-primary rtl:origin-right" />
      </span>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
