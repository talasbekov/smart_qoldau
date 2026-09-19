import PaymentMethods from '@/components/client/PaymentMethods';

export default async function PaymentMethodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { locale } = await params;
  const { returnTo } = await searchParams;
  // Only the known checkout/booking pages are valid continuations. No external URLs.
  const candidate = typeof returnTo === 'string' ? returnTo : '';
  const allowed = new RegExp(
    `^/${locale}/consultations/(?:[a-zA-Z0-9-]+/payment|book/[a-zA-Z0-9-]+)$`,
  );
  let destination = `/${locale}/profile`;
  try {
    const url = new URL(candidate, 'https://local.invalid');
    if (
      candidate.startsWith(`/${locale}/`) &&
      !/[\\\r\n]/.test(candidate) &&
      url.origin === 'https://local.invalid' &&
      allowed.test(url.pathname)
    ) {
      destination = url.pathname;
      if (url.pathname.includes('/book/')) {
        const resume = new URLSearchParams();
        const topic = url.searchParams.get('topic') ?? '';
        const format = url.searchParams.get('format') ?? '';
        const slot = url.searchParams.get('slot') ?? '';
        if (/^[a-zA-Z0-9-]{1,100}$/.test(topic)) resume.set('topic', topic);
        if (['chat', 'audio', 'video'].includes(format))
          resume.set('format', format);
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(slot))
          resume.set('slot', slot);
        if (resume.size) destination += `?${resume}`;
      }
    }
  } catch {
    /* Keep the local profile fallback. */
  }
  return <PaymentMethods locale={locale} returnTo={destination} />;
}
