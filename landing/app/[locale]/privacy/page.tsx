import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPageLayout from '@/components/LegalPageLayout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacy');
  return { title: `${t('title')} — SmartQoldau` };
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacy');
  const sections = Array.from({ length: 6 }, (_, i) => ({
    title: t(`section${i + 1}Title` as 'section1Title'),
    text: t(`section${i + 1}Text` as 'section1Text'),
  }));
  return <LegalPageLayout pageTitle={t('title')} effectiveDate={t('effectiveDate')} sections={sections} />;
}
