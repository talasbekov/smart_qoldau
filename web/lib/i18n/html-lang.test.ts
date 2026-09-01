import { htmlLang } from './html-lang';

describe('htmlLang', () => {
  it('переводит слаг kz в код языка kk', () => {
    // kz — код страны, а не языка: с lang="kz" скринридер получает
    // несуществующий язык и читает казахский по правилам своего.
    expect(htmlLang('kz')).toBe('kk');
  });

  it('русский совпадает со слагом', () => {
    expect(htmlLang('ru')).toBe('ru');
  });

  it('незнакомый слаг отдаётся как есть, а не молча ломается', () => {
    expect(htmlLang('en')).toBe('en');
  });
});
