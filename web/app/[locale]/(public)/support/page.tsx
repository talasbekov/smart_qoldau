import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SupportForm from '@/components/SupportForm';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support');
  return { title: `${t('title')} — SmartQoldau` };
}

export default async function SupportPage() {
  const t = await getTranslations('support');

  return (
    <main className="max-w-[900px] mx-auto px-8 py-14">
      <h1 className="text-[30px] font-extrabold text-ink mb-2">{t('title')}</h1>
      <p className="text-body mb-5">{t('subtitle')}</p>

      <div className="rounded-2xl bg-[#fdece3] p-4 mb-9 text-[#8a3a2e] text-xs font-semibold leading-relaxed">
        {t('emergencyNotice')}
      </div>

      <div className="mb-9 flex flex-col items-start gap-2 rounded-2xl border border-border p-5">
        <Link
          href="/support/requests"
          className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {t('myRequests')}
        </Link>
        <p className="text-sm text-body">{t('guestLimit')}</p>
      </div>

      <h2 className="font-extrabold text-ink mb-4">{t('formTitle')}</h2>
      <SupportForm />
    </main>
  );
}
