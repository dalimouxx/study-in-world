import { setRequestLocale } from 'next-intl/server';
import { BlogPage } from '@/features/blog/blog-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <BlogPage />;
}
