import { Injectable } from '@nestjs/common';
import { Prisma, ProfileFieldStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { apiError } from '../common/filters/app-exception.filter';

// Общая машина «на проверке → опубликовано» для фото и текста «о себе»
// (E2a, задача 4). Одна на оба поля намеренно: продублированное правило
// разъезжается, а публикация непроверенного контента — не косметика.
export type ModeratedField = 'photo' | 'about';

@Injectable()
export class ProfileModerationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  /// Значение уходит на проверку, опубликованное не трогается (Р-18).
  submitAboutData(value: string): Prisma.ExpertUpdateInput {
    return {
      aboutPending: value,
      aboutStatus: ProfileFieldStatus.PENDING,
      moderationComment: null,
    };
  }

  /// Снятие текста целиком: и опубликованного, и того, что на проверке.
  clearAboutData(): Prisma.ExpertUpdateInput {
    return {
      about: null,
      aboutPending: null,
      aboutStatus: ProfileFieldStatus.NONE,
      moderationComment: null,
    };
  }

  async approve(
    expertId: string,
    field: ModeratedField,
    adminId: string,
  ): Promise<void> {
    const removedKey = await this.prisma.$transaction(async (tx) => {
      const expert = await this.lockPending(tx, expertId, field);
      if (field === 'about') {
        await tx.expert.update({
          where: { id: expertId },
          data: {
            about: expert.aboutPending,
            aboutPending: null,
            aboutStatus: ProfileFieldStatus.APPROVED,
            moderationComment: null,
          },
        });
        return null;
      }
      await tx.expert.update({
        where: { id: expertId },
        data: {
          photoKey: expert.photoPendingKey,
          photoPendingKey: null,
          photoStatus: ProfileFieldStatus.APPROVED,
          moderationComment: null,
        },
      });
      // Прежнее опубликованное фото больше не нужно.
      return expert.photoKey;
    });

    if (removedKey) await this.storage.deleteAvatar(removedKey);
    await this.log(expertId, `expert.${field}_approved`, adminId, {});
  }

  async reject(
    expertId: string,
    field: ModeratedField,
    adminId: string,
    comment: string,
  ): Promise<void> {
    const trimmed = comment?.trim();
    if (!trimmed) {
      // Специалист должен понимать, что исправить (тот же принцип, что и
      // обязательная причина блокировки в Р-19).
      apiError(
        'MODERATION_COMMENT_REQUIRED',
        'Отклонение требует причины',
        400,
      );
    }

    const removedKey = await this.prisma.$transaction(async (tx) => {
      const expert = await this.lockPending(tx, expertId, field);
      if (field === 'about') {
        await tx.expert.update({
          where: { id: expertId },
          data: {
            aboutPending: null,
            aboutStatus: ProfileFieldStatus.REJECTED,
            moderationComment: trimmed,
          },
        });
        return null;
      }
      await tx.expert.update({
        where: { id: expertId },
        data: {
          photoPendingKey: null,
          photoStatus: ProfileFieldStatus.REJECTED,
          moderationComment: trimmed,
        },
      });
      return expert.photoPendingKey;
    });

    if (removedKey) await this.storage.deleteAvatar(removedKey);
    await this.log(expertId, `expert.${field}_rejected`, adminId, {
      comment: trimmed,
    });
  }

  /// Блокировка строки специалиста и проверка, что поле действительно ждёт
  /// решения. Именно блокировка, а не read-then-write: два оператора,
  /// одновременно нажавшие «Одобрить» и «Отклонить», иначе оба получат
  /// успех, и последний перезапишет первого (урок финального ревью E8a).
  private async lockPending(
    tx: Prisma.TransactionClient,
    expertId: string,
    field: ModeratedField,
  ) {
    await tx.$queryRaw`SELECT id FROM experts WHERE id = ${expertId} FOR UPDATE`;
    const expert = await tx.expert.findUnique({ where: { id: expertId } });
    if (!expert) apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);
    const status = field === 'about' ? expert.aboutStatus : expert.photoStatus;
    if (status !== ProfileFieldStatus.PENDING) {
      apiError('NOTHING_TO_MODERATE', 'Поле не ждёт решения', 409);
    }
    return expert;
  }

  private log(
    expertId: string,
    transition: string,
    adminId: string,
    payload: object,
  ): Promise<void> {
    return this.audit.log({
      actorType: 'admin',
      actorId: adminId,
      entity: 'expert',
      entityId: expertId,
      transition,
      payload,
    });
  }
}
