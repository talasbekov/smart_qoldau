import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly s3: S3Client;
  private readonly bucket: string;
  // Аватары держатся отдельно от документов верификации: документы
  // зашифрованы и закрыты (ТЗ §6), фото раздаётся всем. Общий бакет — это
  // либо ослабленная защита документов, либо сломанная раздача фото.
  private readonly avatarsBucket: string;
  // Материалы самопомощи (E13): свой бакет и, в отличие от аватаров,
  // закрытый — часть контента за Premium-пейволлом, а публично читаемый
  // бакет сделал бы пейволл декоративным.
  private readonly contentBucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow('S3_BUCKET_DOCUMENTS');
    this.avatarsBucket = config.getOrThrow('S3_BUCKET_AVATARS');
    this.contentBucket = config.getOrThrow('S3_BUCKET_CONTENT');
    // В проде клиент ходит на публичный домен (CDN), а бэкенд пишет во
    // внутренний адрес хранилища — по умолчанию это одно и то же.
    this.publicBaseUrl = String(
      config.get('S3_PUBLIC_BASE_URL') ?? config.getOrThrow('S3_ENDPOINT'),
    ).replace(/\/+$/, '');
    this.s3 = new S3Client({
      endpoint: config.getOrThrow('S3_ENDPOINT'),
      region: 'us-east-1',
      forcePathStyle: true, // MinIO
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
    await this.ensureAvatarsBucket();
    await this.ensureContentBucket();
  }

  async ensureBucket(): Promise<void> {
    await this.ensureBucketExists(this.bucket);
  }

  /// Бакет аватаров плюс политика публичного чтения: без списка объектов
  /// он защищён только неугадываемостью ключа, а ключ — UUID v4.
  async ensureAvatarsBucket(): Promise<void> {
    await this.ensureBucketExists(this.avatarsBucket);
    await this.s3.send(
      new PutBucketPolicyCommand({
        Bucket: this.avatarsBucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.avatarsBucket}/*`],
            },
          ],
        }),
      }),
    );
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async putAvatar(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.avatarsBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteAvatar(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.avatarsBucket, Key: key }),
    );
  }

  avatarUrl(key: string): string {
    return `${this.publicBaseUrl}/${this.avatarsBucket}/${key}`;
  }

  /// Бакет материалов — без политики публичного чтения: читать его можно
  /// только по подписанной ссылке из contentUrl().
  async ensureContentBucket(): Promise<void> {
    await this.ensureBucketExists(this.contentBucket);
  }

  async putContentObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.contentBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteContentObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.contentBucket, Key: key }),
    );
  }

  /// Подписанная ссылка на материал. Файл отдаёт S3 напрямую: гонять
  /// мегабайты аудио через Node — верный способ положить бэкенд на первой
  /// сотне слушателей. TTL короткий, потому что ссылка И ЕСТЬ доступ.
  contentUrl(key: string, ttlSec = 900): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.contentBucket, Key: key }),
      { expiresIn: ttlSec },
    );
  }

  getSignedDownloadUrl(key: string, ttlSec = 300): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSec },
    );
  }
}
