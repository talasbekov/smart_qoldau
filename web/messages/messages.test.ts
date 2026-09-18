import ru from './ru.json';
import kz from './kz.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('переводы ru/kz', () => {
  it('содержат отдельные строки для каталога и материалов', () => {
    expect(kz).toMatchObject({
      catalog: { title: expect.any(String), metadataTitle: expect.any(String), metadataDescription: expect.any(String), filters: { format: expect.any(String) } },
      materials: { title: expect.any(String), metadataTitle: expect.any(String), metadataDescription: expect.any(String), kindArticle: expect.any(String) },
    });
  });

  it('наборы ключей совпадают', () => {
    const ruKeys = flattenKeys(ru).sort();
    const kzKeys = flattenKeys(kz).sort();
    expect(kzKeys).toEqual(ruKeys);
  });
});
