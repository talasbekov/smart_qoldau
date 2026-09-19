import type { Metadata } from 'next';
import RenewSession from '@/components/auth/RenewSession';
import { renewalTarget } from '@/lib/auth/renewal-navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function RenewalPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { locale } = await params;
  const value = (await searchParams).returnTo;
  return <RenewSession locale={locale} returnTo={renewalTarget(typeof value === 'string' ? value : undefined, locale)} />;
}
