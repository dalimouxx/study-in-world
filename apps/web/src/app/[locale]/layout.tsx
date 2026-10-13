import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Caveat, Poppins, Readex_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { isRtl, routing } from '@/i18n/routing';
import '../globals.css';

// Identité « Study in World — Premium Travel Editorial » (site public) : Poppins pour le texte latin fonctionnel,
// Readex Pro conservé pour l'arabe (Poppins n'a pas de glyphes arabes — l'identité visuelle ne doit jamais casser
// le rendu de la version arabe). Caveat pour les touches manuscrites décoratives, réservé au français : il n'existe
// pas d'équivalent manuscrit arabe fidèle à cet univers, donc la version arabe utilise plutôt la police principale
// en gras à la place (voir HandwrittenTagline).
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });
const arabic = Readex_Pro({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' });
const handwritten = Caveat({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-handwritten', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: { default: t('title'), template: `%s · ${t('title')}` }, robots: { index: false, follow: false } };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = isRtl(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${poppins.variable} ${arabic.variable} ${handwritten.variable} ${locale === 'ar' ? 'lang-ar' : 'lang-fr'}`}>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
