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
  it('наборы ключей совпадают', () => {
    const ruKeys = flattenKeys(ru).sort();
    const kzKeys = flattenKeys(kz).sort();
    expect(kzKeys).toEqual(ruKeys);
  });
});
