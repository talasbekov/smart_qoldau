import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Проверяет реальную политику MinIO: отдельный бакет аватаров должен
// разрешать публичное чтение, в отличие от закрытых документов.
describe('StorageService: аватар читается без подписи (MinIO)', () => {
  let service: StorageService;

  beforeAll(async () => {
    service = new StorageService(
      new ConfigService({
        S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'sq-minio',
        S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'sq-minio-secret',
        S3_BUCKET_DOCUMENTS:
          process.env.S3_BUCKET_DOCUMENTS ?? 'expert-documents-test',
        S3_BUCKET_AVATARS: process.env.S3_BUCKET_AVATARS ?? 'sq-avatars-test',
        S3_BUCKET_CONTENT: process.env.S3_BUCKET_CONTENT ?? 'sq-content-test',
      }),
    );
    await service.ensureAvatarsBucket();
  });

  it('положенный аватар доступен по avatarUrl, а после удаления — нет', async () => {
    const key = `spec-avatar-${Date.now()}.txt`;
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
