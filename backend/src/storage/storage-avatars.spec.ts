import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Фотографии специалистов лежат в отдельном бакете (E2a, задача 2): у них и
// у документов верификации противоположные требования доступа — документы
// закрыты и доступны единицам, аватары раздаются всем. Ошибка «положили
// фото в бакет документов» должна быть невозможна по сигнатуре, поэтому
// проверяется именно имя бакета в вызове S3, а не факт успеха.
const DOCUMENTS_BUCKET = 'expert-documents-test';
const AVATARS_BUCKET = 'sq-avatars-test';

function bucketsOf(service: StorageService): string[] {
  const sent = (service as any).s3.send.mock.calls as { input: any }[][];
  return sent.map(([command]) => (command as any).input.Bucket);
}

describe('StorageService: бакет аватаров', () => {
  let service: StorageService;

  beforeEach(() => {
    const config = new ConfigService({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'sq-minio',
      S3_SECRET_KEY: 'sq-minio-secret',
      S3_BUCKET_DOCUMENTS: DOCUMENTS_BUCKET,
      S3_BUCKET_AVATARS: AVATARS_BUCKET,
      S3_BUCKET_CONTENT: 'sq-content-test',
    });
    service = new StorageService(config);
    jest.spyOn((service as any).s3, 'send').mockResolvedValue({} as never);
  });

  it('putAvatar кладёт объект в бакет аватаров, а не документов', async () => {
    await service.putAvatar('a1b2.webp', Buffer.from('img'), 'image/webp');
    expect(bucketsOf(service)).toEqual([AVATARS_BUCKET]);
  });

  it('deleteAvatar удаляет из бакета аватаров', async () => {
    await service.deleteAvatar('a1b2.webp');
    expect(bucketsOf(service)).toEqual([AVATARS_BUCKET]);
  });

  it('методы документов бакет аватаров не трогают', async () => {
    await service.putObject('doc.pdf', Buffer.from('pdf'), 'application/pdf');
    expect(bucketsOf(service)).toEqual([DOCUMENTS_BUCKET]);
  });

  it('avatarUrl собирает публичный адрес из базового URL, бакета и ключа', () => {
    expect(service.avatarUrl('a1b2.webp')).toBe(
      `http://localhost:9000/${AVATARS_BUCKET}/a1b2.webp`,
    );
  });

  it('публичный базовый URL переопределяется отдельно от адреса S3', () => {
    const config = new ConfigService({
      S3_ENDPOINT: 'http://minio.internal:9000',
      S3_ACCESS_KEY: 'k',
      S3_SECRET_KEY: 's',
      S3_BUCKET_DOCUMENTS: DOCUMENTS_BUCKET,
      S3_BUCKET_AVATARS: AVATARS_BUCKET,
      S3_BUCKET_CONTENT: 'sq-content-test',
      // В проде клиент ходит на CDN/публичный домен, а бэкенд пишет во
      // внутренний адрес — это разные вещи.
      S3_PUBLIC_BASE_URL: 'https://cdn.smartqoldau.kz/',
    });
    expect(new StorageService(config).avatarUrl('a1b2.webp')).toBe(
      `https://cdn.smartqoldau.kz/${AVATARS_BUCKET}/a1b2.webp`,
    );
  });
});

// Отдельный блок против живого MinIO: политика публичного чтения — это то,
// ради чего бакет вообще разделён, и мок её не проверяет.
describe('StorageService: аватар читается без подписи (MinIO)', () => {
  let service: StorageService;

  beforeAll(async () => {
    service = new StorageService(
      new ConfigService({
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'sq-minio',
        S3_SECRET_KEY: 'sq-minio-secret',
        S3_BUCKET_DOCUMENTS: DOCUMENTS_BUCKET,
        S3_BUCKET_AVATARS: AVATARS_BUCKET,
        S3_BUCKET_CONTENT: 'sq-content-test',
      }),
    );
    await service.ensureAvatarsBucket();
  });

  it('положенный аватар доступен по avatarUrl, а после удаления — нет', async () => {
    const key = 'spec-avatar.txt';
    await service.putAvatar(key, Buffer.from('avatar-bytes'), 'text/plain');

    const url = service.avatarUrl(key);
    expect(url).not.toContain('X-Amz-Signature');
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('avatar-bytes');

    await service.deleteAvatar(key);
    expect((await fetch(url)).status).toBe(404);
  });
});
