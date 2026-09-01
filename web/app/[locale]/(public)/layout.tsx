import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Раскладка публичной части: шапка, подвал и всё, что видит аноним.
// Кабинеты живут в группах (client) и (expert) со своими раскладками —
// шапка маркетингового сайта им не нужна.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Первым в порядке обхода, до шапки: иначе с клавиатуры до текста
          страницы надо прощёлкать всю навигацию, и так на каждой странице.
          Видна только при фокусе. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Перейти к основному содержимому
      </a>
      <Header />
      <div id="main">{children}</div>
      <Footer />
    </>
  );
}
