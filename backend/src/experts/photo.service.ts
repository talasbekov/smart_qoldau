import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Expert, ProfileFieldStatus } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { apiError } from '../common/filters/app-exception.filter';

// Фотография специалиста (E2a, задача 3). Проверяется по фактическому
// содержимому: и Content-Type, и расширение подделываются одинаково легко,
// а фото попадает в публичный профиль.
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 200;
const MAX_RATIO = 2; // от 1:2 до 2:1
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
const OUTPUT_SIDE = 512;
const OUTPUT_QUALITY = 82;

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  async upload(
    expert: Expert,
    file: Express.Multer.File | undefined,
  ): Promise<{ status: ProfileFieldStatus }> {
    const body = file?.buffer;
    if (!body?.length) {
      apiError('PHOTO_INVALID', 'Файл не передан', 400);
    }
    if (body.length > MAX_BYTES) {
      apiError('PHOTO_INVALID', 'Файл больше 5 МБ', 400);
    }

    const normalized = await this.normalize(body);

    // Новый ключ на каждую загрузку: публичный бакет без списка объектов
    // защищён только неугадываемостью ключа, поэтому UUID v4, а не
    // производная от id специалиста.
    const key = `${randomUUID()}.webp`;
    await this.storage.putAvatar(key, normalized, 'image/webp');

    const previousPending = expert.photoPendingKey;
    await this.prisma.expert.update({
      where: { id: expert.id },
      // Опубликованное photoKey не трогается: пока новое фото проверяется,
      // профиль продолжает показывать старое (Р-18).
      data: {
        photoPendingKey: key,
        photoStatus: ProfileFieldStatus.PENDING,
        moderationComment: null,
      },
    });

    // Мусор в хранилище не копится: прежнее фото на проверке уже неактуально.
    if (previousPending) await this.storage.deleteAvatar(previousPending);

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.photo_submitted',
      payload: {},
    });

    return { status: ProfileFieldStatus.PENDING };
  }

  async remove(expert: Expert): Promise<void> {
    await this.prisma.expert.update({
      where: { id: expert.id },
      data: {
        photoKey: null,
        photoPendingKey: null,
        photoStatus: ProfileFieldStatus.NONE,
        moderationComment: null,
      },
    });
    for (const key of [expert.photoKey, expert.photoPendingKey]) {
      if (key) await this.storage.deleteAvatar(key);
    }
    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.photo_removed',
      payload: {},
    });
  }

  /// Квадрат 512×512 webp без метаданных. EXIF снимка содержит геолокацию
  /// и модель устройства — публиковать их нельзя, поэтому пересборка идёт
  /// без `withMetadata()`, то есть метаданные срезаются.
  private async normalize(body: Buffer): Promise<Buffer> {
    const meta = await sharp(body)
      .metadata()
      .catch(() => {
        apiError('PHOTO_INVALID', 'Файл не является изображением', 400);
      });

    const { format, width, height } = meta;
    if (!format || !ALLOWED_FORMATS.includes(format)) {
      apiError('PHOTO_INVALID', 'Поддерживаются только JPEG, PNG и WebP', 400);
    }
    if (!width || !height) {
      apiError(
        'PHOTO_INVALID',
        'Не удалось прочитать размеры изображения',
        400,
      );
    }
    if (Math.min(width, height) < MIN_SIDE) {
      apiError(
        'PHOTO_INVALID',
        `Минимальная сторона изображения — ${MIN_SIDE} px`,
        400,
      );
    }
    const ratio = width / height;
    if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) {
      apiError(
        'PHOTO_INVALID',
        'Соотношение сторон должно быть между 1:2 и 2:1',
        400,
      );
    }

    return sharp(body)
      .resize(OUTPUT_SIDE, OUTPUT_SIDE, { fit: 'cover', position: 'centre' })
      .webp({ quality: OUTPUT_QUALITY })
      .toBuffer();
  }
}
