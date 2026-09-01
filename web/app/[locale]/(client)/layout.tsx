// Каркас кабинета клиента. Наполняется в плане B; существует сейчас,
// чтобы маршруты кабинета не наследовали шапку и подвал публичной части.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="client-shell">{children}</div>;
}
