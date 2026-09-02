import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Вход',
  // Страница входа в поиске не нужна и только размывает выдачу.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-8 py-20">
      <h1 className="mb-2 text-2xl font-extrabold text-ink">Вход в SmartQoldau</h1>
      <p className="mb-8 text-center text-sm text-muted">
        Пришлём код в SMS — пароль не нужен
      </p>
      <LoginForm />
    </main>
  );
}
