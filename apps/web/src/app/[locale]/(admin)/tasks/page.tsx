import { setRequestLocale } from 'next-intl/server';
import { TasksPage } from '@/features/tasks/tasks-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <TasksPage />;
}
