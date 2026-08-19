import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService (MinIO)', () => {
  let service: StorageService;
  beforeAll(async () => {
    const config = new ConfigService({
      S3_ENDPOINT: 'http://localhost:9000', S3_ACCESS_KEY: 'sq-minio',
      S3_SECRET_KEY: 'sq-minio-secret', S3_BUCKET_DOCUMENTS: 'expert-documents-test',
    });
    service = new StorageService(config);
    await service.ensureBucket();
  });

  it('кладёт объект и выдаёт подписанный URL с TTL', async () => {
    await service.putObject('spec/test.txt', Buffer.from('hello'), 'text/plain');
    const url = await service.getSignedDownloadUrl('spec/test.txt');
    expect(url).toContain('spec/test.txt');
    expect(url).toContain('X-Amz-Signature');
    const res = await fetch(url);
    expect(await res.text()).toBe('hello');
  });
});
