import type { ExpertPublic } from '@/lib/api/public';

// Микроразметка индексируется и живёт в кэшах поисковика дольше, чем сама
// страница, поэтому поля перечисляются явно — ровно как публичная карточка
// собирается на бэкенде. Никаких spread по объекту эксперта.
export default function ExpertJsonLd({ expert, url }: { expert: ExpertPublic; url: string }) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: expert.displayName,
    jobTitle: 'Психолог',
    address: { '@type': 'PostalAddress', addressLocality: expert.city },
    knowsLanguage: expert.languages,
    url,
    offers: {
      '@type': 'Offer',
      price: String(Math.round(expert.priceTiyn / 100)),
      priceCurrency: 'KZT',
      availability:
        expert.workStatus === 'ACCEPTING'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/LimitedAvailability',
    },
  };

  if (expert.ratingCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: expert.ratingAvg,
      reviewCount: expert.ratingCount,
    };
  }

  // `</script>` внутри JSON закрывает тег и превращает остаток в разметку.
  // Имя приходит из профиля, который заполняет человек, — экранируем.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
