import sitemap from './sitemap';

describe('sitemap', () => {
  it('содержит все 6 страниц на обеих локалях (12 URL)', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(12);
    expect(entries.some((e) => e.url.endsWith('/ru'))).toBe(true);
    expect(entries.some((e) => e.url.endsWith('/kz'))).toBe(true);
    expect(entries.some((e) => e.url.endsWith('/ru/premium'))).toBe(true);
    expect(entries.some((e) => e.url.endsWith('/kz/support'))).toBe(true);
  });
});
