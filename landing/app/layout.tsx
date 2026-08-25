// Локаль в URL и редирект "/" -> "/ru" полностью на middleware.ts
// (next-intl, localePrefix по умолчанию "always") — этот layout лишь
// пробрасывает children, <html>/<body> задаёт app/[locale]/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
