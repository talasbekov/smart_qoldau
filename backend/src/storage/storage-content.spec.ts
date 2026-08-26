import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Материалы самопомощи (E13) лежат в своём бакете и, в отличие от аватаров,
// закрыты: часть контента за Premium-пейволлом, а публично читаемый бакет
// сделал бы пейволл декоративным — ссылку достаточно один раз узнать.
const DOCUMENTS_BUCKET = 'expert-documents-test';
const AVATARS_BUCKET = 'sq-avatars-test';
const CONTENT_BUCKET = 'sq-content-test';

function bucketsOf(service: StorageService): string[] {
  const sent = (service as any).s3.send.mock.calls as { input: any }[][];
  return sent.map(([command]) => (command as any).input.Bucket);
}

describe('StorageService: бакет материалов', () => {
  let service: StorageService;

  beforeEach(() => {
    const config = new ConfigService({
      S3_ENDPOINT: 'http://localhost:9000',
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

  it('contentUrl подписывает ссылку с заданным TTL', async () => {
    const url = await service.contentUrl('meditations/sleep-1.mp3', 900);
    expect(url).toContain('meditations/sleep-1.mp3');
    expect(url).toContain(CONTENT_BUCKET);
    // Ссылка обязана истекать: вечная ссылка на платный материал
    // равносильна его отсутствию за пейволлом.
    expect(url).toContain('X-Amz-Expires=900');
  });

  it('deleteContentObject удаляет из бакета материалов', async () => {
    await service.deleteContentObject('meditations/sleep-1.mp3');
    expect(bucketsOf(service)).toEqual([CONTENT_BUCKET]);
  });
});
