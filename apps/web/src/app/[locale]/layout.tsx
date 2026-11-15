import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bricolage_Grotesque, Readex_Pro, Sora } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { isRtl, routing } from '@/i18n/routing';
import '../globals.css';

// Identité « Bento Pop » : Bricolage Grotesque pour les titres latins, Sora pour le texte latin, Readex Pro pour
// tout le texte arabe (titres compris) — aucune police latine ne doit s'appliquer à l'arabe (voir globals.css).
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const arabic = Readex_Pro({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' });

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
    <html lang={locale} dir={dir} className={`${bricolage.variable} ${sora.variable} ${arabic.variable} ${locale === 'ar' ? 'lang-ar' : 'lang-fr'}`}>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
