interface Section {
  title: string;
  text: string;
}

export default function LegalPageLayout({
  pageTitle,
  effectiveDate,
  sections,
}: {
  pageTitle: string;
  effectiveDate: string;
  sections: Section[];
}) {
  return (
    <main className="max-w-[720px] mx-auto px-8 py-14">
      <h1 className="text-[28px] font-extrabold text-ink mb-1">{pageTitle}</h1>
      <div className="text-faint text-xs font-semibold mb-9">{effectiveDate}</div>
      <div className="flex flex-col gap-7">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="font-extrabold text-ink mb-2">{s.title}</div>
            <div className="text-body text-sm leading-relaxed">{s.text}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
