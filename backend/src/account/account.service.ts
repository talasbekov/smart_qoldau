import { Injectable } from '@nestjs/common';
import {
  ConsultationStatus,
  PaymentStatus,
  Prisma,
  RequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { apiError } from '../common/filters/app-exception.filter';

// Консультации, которые ещё не сыграли: удалять аккаунт посреди них
// нельзя — на другой стороне живой человек и незакрытые деньги.
const OPEN_CONSULTATION_STATUSES: ConsultationStatus[] = [
  ConsultationStatus.ACTIVE,
  ConsultationStatus.SCHEDULED,
];

// Платежи в работе: холд поставлен, но ещё не списан и не отменён.
const OPEN_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.HELD,
];

/**
 * Удаление аккаунта и данных по запросу (ТЗ §5.1; политика
 * конфиденциальности обещает это «через настройки профиля или обратившись
 * в поддержку»).
 *
 * Строка пользователя НЕ удаляется физически: на неё ссылаются
 * консультации, платежи и проводки, а бухгалтерию нельзя терять по запросу
 * одной из сторон — её обязаны хранить обе, и налоговая тоже. Вместо этого
 * из аккаунта вычищается всё, что является персональными данными, а сам он
 * помечается `deletedAt`. Телефон при этом освобождается: повторный вход по
 * тому же номеру заводит НОВЫЙ аккаунт, а не воскрешает старый.
 */
@Injectable()
export class AccountService {
  // Р-27: согласие принимается ОДИН раз, вместе с именем — двумя шагами
  // в этом месте человек с большей вероятностью передумает.
  //
  // Повторный вызов НЕ переписывает время: согласие датируется моментом,
  // когда его дали впервые, иначе граница «до/после» поедет и прошлые
  // консультации задним числом окажутся раскрытыми.
  async acceptExpertVisibility(
    userId: string,
    displayName: string,
  ): Promise<{ displayName: string; expertVisibilityAcceptedAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      apiError('NOT_FOUND', 'Аккаунт не найден', 404);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName.trim(),
        expertVisibilityAcceptedAt:
          user.expertVisibilityAcceptedAt ?? this.clock.now(),
      },
    });

    return {
      displayName: updated.displayName!,
      expertVisibilityAcceptedAt: updated.expertVisibilityAcceptedAt!,
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, expertVisibilityAcceptedAt: true },
    });
    if (!user) apiError('NOT_FOUND', 'Аккаунт не найден', 404);

    return user;
  }

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
  ) {}

  async deleteOwn(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { expert: { select: { id: true } } },
    });
    if (!user || user.deletedAt) {
      // Токен пережил удаление аккаунта (access живёт до 15 минут) —
      // отвечаем так же, как незнакомцу.
      apiError('NOT_FOUND', 'Аккаунт не найден', 404);
    }

    // У специалиста висят выплаты, договорные обязательства и документы
    // верификации: их разбирает человек, а не кнопка в приложении.
    if (user.expert) {
      apiError(
        'EXPERT_DELETE_VIA_SUPPORT',
        'Удаление аккаунта специалиста — через поддержку',
        409,
      );
    }

    const openConsultations = await this.prisma.consultation.count({
      where: {
        clientUserId: userId,
        status: { in: OPEN_CONSULTATION_STATUSES },
      },
    });
    if (openConsultations > 0) {
      apiError(
        'CONSULTATION_IN_PROGRESS',
        'Сначала завершите или отмените консультацию',
        409,
      );
    }

    const openPayments = await this.prisma.payment.count({
      where: { clientUserId: userId, status: { in: OPEN_PAYMENT_STATUSES } },
    });
    if (openPayments > 0) {
      apiError(
        'PAYMENT_IN_PROGRESS',
        'Дождитесь завершения расчёта по консультации',
        409,
      );
    }

    const consultations = await this.prisma.consultation.findMany({
      where: { clientUserId: userId },
      select: { id: true },
    });
    const consultationIds = consultations.map((c) => c.id);
    const now = this.clock.now();

    await this.prisma.$transaction(async (tx) => {
      await this.purge(tx, userId, user.phone, consultationIds, now);
    });

    // Журнал — после коммита: он переживает удаление и остаётся
    // доказательством, что запрос был исполнен.
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      entity: 'user',
      entityId: userId,
      transition: 'user.deleted',
      payload: { consultations: consultationIds.length },
    });
  }

  /// Всё содержательное — удаляется; всё учётное — остаётся.
  private async purge(
    tx: Prisma.TransactionClient,
    userId: string,
    phone: string | null,
    consultationIds: string[],
    now: Date,
  ): Promise<void> {
    if (consultationIds.length) {
      // Переписка и приватная заметка специалиста об этом клиенте:
      // содержимое консультации — самые чувствительные данные в системе,
      // и хранить их после удаления аккаунта не на чем.
      await tx.chatMessage.deleteMany({
        where: { consultationId: { in: consultationIds } },
      });
      await tx.expertNote.deleteMany({
        where: { consultationId: { in: consultationIds } },
      });
      // Отзыв остаётся: он уже анонимен для читателя, а рейтинг
      // специалиста нельзя пересчитывать задним числом из-за ухода
      // клиента. Но тексты, которые писал человек, — это его данные.
      await tx.review.updateMany({
        where: { consultationId: { in: consultationIds } },
        data: {
          publicText: null,
          privateText: null,
          complaint: null,
        },
      });
    }

    await tx.device.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    // Очередь отправки хранит СВОЮ копию содержимого уведомления
    // (`payload` — то, что ушло бы в пуш) и не связана с `notifications`
    // внешним ключом: без этой строки тексты пережили бы удаление
    // аккаунта в соседней таблице.
    await tx.notificationOutbox.deleteMany({ where: { userId } });
    await tx.favorite.deleteMany({ where: { userId } });
    // Карты удаляются целиком, а не soft-delete, как при обычной отвязке:
    // токен провайдера — платёжный реквизит, ему незачем переживать
    // аккаунт. Платежи ссылаются на paymentMethodId строкой без внешнего
    // ключа, поэтому история расчётов не рвётся.
    await tx.paymentMethod.deleteMany({ where: { userId } });

    // Доступ закрывается немедленно: все refresh-токены отозваны, новый
    // выдать больше нечем.
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    // Незавершённые заявки на подбор — тоже данные пользователя, но их
    // офферы участвуют в скоринге специалистов, поэтому снимаем сами
    // заявки только с открытых статусов, а историю офферов не трогаем.
    await tx.request.updateMany({
      where: {
        clientUserId: userId,
        status: {
          in: [
            RequestStatus.SEARCHING,
            RequestStatus.NO_EXPERTS,
            RequestStatus.CALLBACK_REQUESTED,
          ],
        },
      },
      data: { status: 'CANCELLED', closedAt: now },
    });

    // Запрошенный, но не использованный код входа — тоже след аккаунта.
    if (phone) await tx.smsCode.deleteMany({ where: { phone } });

    // Журнал переходов остаётся целиком — он доказательство, что запрос
    // исполнен, и вообще не должен редактироваться задним числом. Но одно
    // событие хранит в payload номер телефона (`user.guest_converted`), а
    // номер — ровно те данные, которые обещано удалить. Затираем только
    // его, сохраняя сам факт события.
    await tx.auditLog.updateMany({
      where: { entityId: userId, transition: 'user.guest_converted' },
      data: { payload: {} },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        phone: null,
        deviceId: null,
        isGuest: false,
        deletedAt: now,
      },
    });
  }
}
