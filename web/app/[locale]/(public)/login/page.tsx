import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';
import { validatedConsultationReturnTo } from '@/lib/auth/return-to';

export const metadata: Metadata = {
  title: 'Вход',
  // Страница входа в поиске не нужна и только размывает выдачу.
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { locale } = await params;
  const rawReturnTo = (await searchParams).returnTo;
  const returnTo = validatedConsultationReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    locale,
  );

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-8 py-20">
      <h1 className="mb-2 text-2xl font-extrabold text-ink">Вход в SmartQoldau</h1>
      <p className="mb-8 text-center text-sm text-muted">
        Пришлём код в SMS — пароль не нужен
      </p>
      <LoginForm locale={locale} returnTo={returnTo ?? undefined} />
    </main>
  );
}
