import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Материалы самопомощи (E13) лежат в своём бакете и, в отличие от аватаров,
// закрыты: часть контента за Premium-пейволлом, а публично читаемый бакет
// сделал бы пейволл декоративным — ссылку достаточно один раз узнать.
const DOCUMENTS_BUCKET = 'expert-documents-test';
const AVATARS_BUCKET = 'sq-avatars-test';
const CONTENT_BUCKET = 'sq-content-test';
const INTERNAL_ENDPOINT = 'http://minio.internal:9000';
const PUBLIC_ENDPOINT = 'http://localhost:18080';

function bucketsOf(service: StorageService): string[] {
  const sent = (service as any).s3.send.mock.calls as { input: any }[][];
  return sent.map(([command]) => (command as any).input.Bucket);
}

describe('StorageService: бакет материалов', () => {
  let service: StorageService;

  beforeEach(() => {
    const config = new ConfigService({
      S3_ENDPOINT: INTERNAL_ENDPOINT,
      S3_CONTENT_PUBLIC_ENDPOINT: PUBLIC_ENDPOINT,
      S3_ACCESS_KEY: 'sq-minio',
      S3_SECRET_KEY: 'sq-minio-secret',
      S3_BUCKET_DOCUMENTS: DOCUMENTS_BUCKET,
      S3_BUCKET_AVATARS: AVATARS_BUCKET,
      S3_BUCKET_CONTENT: CONTENT_BUCKET,
    });
    service = new StorageService(config);
    jest.spyOn((service as any).s3, 'send').mockResolvedValue({} as never);
  });

  it('putContentObject кладёт файл в бакет материалов', async () => {
    await service.putContentObject(
      'meditations/sleep-1.mp3',
      Buffer.from('fake-audio'),
      'audio/mpeg',
    );
    expect(bucketsOf(service)).toEqual([CONTENT_BUCKET]);
  });

  it('подписывает content URL для внешнего endpoint, а не internal MinIO', async () => {
    const url = await service.contentUrl('meditations/sleep-1.mp3', 900);
    const parsed = new URL(url);

    expect(parsed.origin).toBe(PUBLIC_ENDPOINT);
    expect(parsed.pathname).toBe(`/${CONTENT_BUCKET}/meditations/sleep-1.mp3`);
    expect(url).not.toContain('minio.internal');
    // Ссылка обязана истекать: вечная ссылка на платный материал
    // равносильна его отсутствию за пейволлом.
    expect(url).toContain('X-Amz-Expires=900');
  });

  it('сохраняет default и custom TTL', async () => {
    const defaultUrl = new URL(
      await service.contentUrl('meditations/default.mp3'),
    );
    const customUrl = new URL(
      await service.contentUrl('meditations/preview.mp3', 17),
    );

    expect(defaultUrl.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(customUrl.searchParams.get('X-Amz-Expires')).toBe('17');
  });

  it('без новой env сохраняет старое поведение через S3_ENDPOINT', async () => {
    const fallback = new StorageService(
      new ConfigService({
        S3_ENDPOINT: INTERNAL_ENDPOINT,
        S3_ACCESS_KEY: 'sq-minio',
        S3_SECRET_KEY: 'sq-minio-secret',
        S3_BUCKET_DOCUMENTS: DOCUMENTS_BUCKET,
        S3_BUCKET_AVATARS: AVATARS_BUCKET,
        S3_BUCKET_CONTENT: CONTENT_BUCKET,
      }),
    );

    const url = new URL(await fallback.contentUrl('legacy.mp3'));
    expect(url.origin).toBe(INTERNAL_ENDPOINT);
    expect(url.pathname).toBe(`/${CONTENT_BUCKET}/legacy.mp3`);
  });

  it('deleteContentObject удаляет из бакета материалов', async () => {
    await service.deleteContentObject('meditations/sleep-1.mp3');
    expect(bucketsOf(service)).toEqual([CONTENT_BUCKET]);
  });
});
