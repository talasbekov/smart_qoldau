import { useTranslations } from 'next-intl';

export default function ConsultationPaymentLoading() {
  const t = useTranslations('checkout');
  return (
    <div
      role="status"
      aria-label={t('loadingPage')}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="h-16 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-[20px] bg-surface motion-reduce:animate-none" />
      <div className="h-56 animate-pulse rounded-[20px] bg-surface motion-reduce:animate-none" />
      <span className="sr-only">{t('loadingPage')}</span>
    </div>
  );
}
