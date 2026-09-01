import { authorizedFetch } from '@/lib/api/authorized';
import PremiumCard, { type PremiumStatus } from '@/components/client/PremiumCard';
import DeleteAccount from '@/components/client/DeleteAccount';
import LogoutButton from '@/components/client/LogoutButton';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const premium = await authorizedFetch<PremiumStatus>('premium');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-ink">Профиль</h1>

      {premium && <PremiumCard status={premium} locale={locale} />}

      <section className="flex flex-col items-start gap-4 border-t border-border pt-6">
        <LogoutButton locale={locale} />
        <DeleteAccount locale={locale} />
      </section>
    </div>
  );
}
