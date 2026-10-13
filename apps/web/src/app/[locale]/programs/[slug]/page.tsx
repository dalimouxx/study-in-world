import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProgramDetailPage } from '@/features/public/program-detail-page';
import { fetchPublicEntity, publicMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/site-url';

interface ProgramSeoData {
  name: string;
  level: string;
  description?: string | null;
  currency: string;
  tuitionFees: number | null;
  university?: { name: string; city: string; country?: { name: string } };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const [t, tp] = await Promise.all([getTranslations({ locale, namespace: 'meta' }), getTranslations({ locale, namespace: 'public' })]);
  const program = await fetchPublicEntity<ProgramSeoData>(`/public/catalog/programs/${slug}`);
  const title = program ? `${program.name} — ${program.university?.name ?? ''}` : t('title');
  const description = program
    ? t('programFallback', { program: program.name, university: program.university?.name ?? '', level: tp(`levels.${program.level}`) })
    : t('homeDescription');
  return publicMetadata({ locale, path: `/programs/${slug}`, title, description });
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const program = await fetchPublicEntity<ProgramSeoData>(`/public/catalog/programs/${slug}`);

  return (
    <>
      {program && (
        // Données structurées (schema.org) : aide les moteurs de recherche à comprendre qu'il s'agit d'un
        // programme d'études précis, avec son établissement et son coût — jamais affiché à l'utilisateur.
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'EducationalOccupationalProgram',
              name: program.name,
              description: program.description ?? undefined,
              url: `${siteUrl()}/${locale}/programs/${slug}`,
              provider: program.university
                ? { '@type': 'CollegeOrUniversity', name: program.university.name, address: { '@type': 'PostalAddress', addressLocality: program.university.city, addressCountry: program.university.country?.name } }
                : undefined,
              ...(program.tuitionFees ? { financialAidEligible: undefined, offers: { '@type': 'Offer', price: program.tuitionFees, priceCurrency: program.currency } } : {}),
            }),
          }}
        />
      )}
      <ProgramDetailPage slug={slug} />
    </>
  );
}
