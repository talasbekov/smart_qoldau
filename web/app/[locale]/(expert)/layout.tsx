// Каркас кабинета эксперта. Наполняется в плане C.
export default function ExpertLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="expert-shell">{children}</div>;
}
