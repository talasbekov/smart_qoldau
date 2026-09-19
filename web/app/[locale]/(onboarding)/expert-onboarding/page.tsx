import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import ExpertOnboarding from '@/components/expert-onboarding/ExpertOnboarding';
import type { ExpertMe } from '@/components/expert-onboarding/types';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ExpertOnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(locale);
  const [expert, topics] = await Promise.all([
    authorizedFetch<ExpertMe>('experts/me'), listTopics(locale === 'kz' ? 'kz' : 'ru'),
  ]);
  // `experts/me` deliberately returns no profile for a new candidate. The
  // onboarding client turns that ordinary state into an application form.
  return <ExpertOnboarding locale={locale} topics={topics} initialExpert={expert} />;
}
