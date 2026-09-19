import Link from 'next/link';
import { journeyCopy } from '@/components/client/journey-copy';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { authorizedFetch } from '@/lib/api/authorized';
import PremiumCard, {
  type PremiumStatus,
} from '@/components/client/PremiumCard';
import DeleteAccount from '@/components/client/DeleteAccount';
import LogoutButton from '@/components/client/LogoutButton';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.account : ru.account;
  const premium = await authorizedFetch<PremiumStatus>('premium');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-ink">{copy.title}</h1>

      <Link
        className="min-h-12 rounded-xl border border-border p-4 font-bold text-primary"
        href={`/${locale}/payment-methods`}
      >
        {journeyCopy(locale).methods}
      </Link>
      {premium && <PremiumCard status={premium} locale={locale} />}

      <section className="flex flex-col items-start gap-4 border-t border-border pt-6">
        <LogoutButton locale={locale} />
        <DeleteAccount locale={locale} />
      </section>
    </div>
  );
}
