import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { Metadata } from 'next';
import { routing } from '@/lib/i18n/routing';
import { htmlLang } from '@/lib/i18n/html-lang';
import '../globals.css';

// Без заголовка страница безымянна во вкладке, в закладках и в выдаче.
// Отдельные страницы переопределяют его своим `metadata`.
export const metadata: Metadata = {
  title: {
    default: 'SmartQoldau — психологическая поддержка онлайн',
    template: '%s | SmartQoldau',
  },
  description:
    'Проверенные психологи в чате, аудио и видео. Конфиденциально, без записи за неделю.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  return (
    <html lang={htmlLang(locale)}>
      <body>
        {/* Шапка и подвал переехали в раскладку группы (public):
            кабинеты клиента и эксперта их не показывают. */}
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
