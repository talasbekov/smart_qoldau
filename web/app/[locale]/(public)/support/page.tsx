import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SupportForm from '@/components/SupportForm';

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-9">
        <div className="rounded-2xl border border-border p-5">
          <div className="text-faint text-xs font-bold mb-1">{t('emailLabel')}</div>
          <div className="font-bold text-ink text-sm">support@smartqoldau.kz</div>
        </div>
        <div className="rounded-2xl border border-border p-5">
          <div className="text-faint text-xs font-bold mb-1">{t('phoneLabel')}</div>
          <div className="font-bold text-ink text-sm">+7 700 000 00 00</div>
        </div>
      </div>

      <h2 className="font-extrabold text-ink mb-4">{t('formTitle')}</h2>
      <SupportForm />
    </main>
  );
}
