import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { ScheduleService } from '../schedule/schedule.service';
import { ClockService } from '../common/clock/clock.service';
import { ScoringService } from './scoring.service';

export interface FindCandidatesParams {
  topicSlug: string;
  format: string;
  excludeExpertIds?: string[];
  urgentOnly?: boolean;
  /// Чем разводить кандидатов с ОДИНАКОВЫМ скором и одинаковым числом
  /// сегодняшних офферов. Без него порядок при полной ничьей один и тот же
  /// для всех заявок сразу, и весь поток бьётся в одного и того же
  /// специалиста: нагрузочный прогон E11 дал 4190 отказов «уже занят» на
  /// 200 успешных приёмов, пока сотни свободных простаивали.
  ///
  /// Передаётся id заявки: порядок остаётся строго детерминированным
  /// (тот же id — тот же порядок, спеки на ничью воспроизводимы), но у
  /// разных заявок он разный.
  tieBreakSeed?: string;
}

/// Псевдослучайный, но воспроизводимый ранг кандидата в рамках одной
/// заявки: одинаковый для одной и той же пары (эксперт, заявка) и разный
/// для разных заявок.
function tieRank(expertId: string, seed: string): number {
  return createHash('md5')
    .update(`${seed}:${expertId}`)
    .digest()
    .readUInt32BE(0);
}

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private schedule: ScheduleService,
    private clock: ClockService,
    private scoring: ScoringService,
  ) {}

  // Конвейер матчинга E3: presence (Redis, только свежие по heartbeat —
  // listFresh) — лишь подсказка о кандидатах; фактический допуск ВСЕГДА
  // перепроверяется из БД (verificationStatus, isBlocked, workStatus,
  // formats, topics), затем расписание на now(). Итог сортируется по скору
  // Р-12 (см. ScoringService), tie-break — меньше офферов за сегодня
  // (Asia/Almaty).
  async findCandidates(params: FindCandidatesParams): Promise<string[]> {
    const { topicSlug, format, excludeExpertIds = [], urgentOnly } = params;

    const availableIds = await this.presence.listFresh();
    const candidateIds = availableIds.filter(
      (id) => !excludeExpertIds.includes(id),
    );
    if (candidateIds.length === 0) return [];

    const experts = await this.prisma.expert.findMany({
      where: {
        id: { in: candidateIds },
        verificationStatus: 'VERIFIED',
        isBlocked: false,
        workStatus: 'ACCEPTING',
        formats: { has: format },
        topics: { some: { topic: { slug: topicSlug } } },
        ...(urgentOnly ? { acceptsUrgent: true } : {}),
      },
      select: { id: true },
      // Детерминизм финальной ничьей: sort() ниже стабилен, поэтому при
      // равных score и todayCount порядок кандидатов = порядок этой выборки.
      // Без orderBy Postgres отдаёт произвольный порядок кучи — оффер при
      // ничьей уходил случайному из равных экспертов.
      orderBy: { createdAt: 'asc' },
    });

    const now = this.clock.now();
    const allowed = await this.schedule.filterWithinSchedule(
      experts.map((e) => e.id),
      now,
    );
    const eligibleIds = experts
      .map((e) => e.id)
      .filter((id) => allowed.has(id));
    if (eligibleIds.length === 0) return [];

    const todayStart = this.startOfAlmatyDay(now);
    const [scoreById, todayOffers] = await Promise.all([
      this.scoring.scoreMany(eligibleIds),
      this.prisma.requestCandidate.groupBy({
        by: ['expertId'],
        where: {
          expertId: { in: eligibleIds },
          offeredAt: { gte: todayStart },
        },
        _count: { _all: true },
      }),
    ]);

    const todayCountById = new Map(
      todayOffers.map((t) => [t.expertId, t._count._all]),
    );

    const seed = params.tieBreakSeed;
    return [...eligibleIds].sort((a, b) => {
      const scoreDiff = (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const offersDiff =
        (todayCountById.get(a) ?? 0) - (todayCountById.get(b) ?? 0);
      if (offersDiff !== 0) return offersDiff;
      // Полная ничья. Без seed порядок остаётся прежним — порядком выборки
      // (sort стабилен), с seed кандидаты раскладываются по-разному для
      // разных заявок, оставаясь воспроизводимыми для одной и той же.
      if (!seed) return 0;
      return tieRank(a, seed) - tieRank(b, seed);
    });
  }

  // Экономный путь для GET /matching/online-count (задача 9 эпика E6,
  // ревью раунд 1, п.1): считает тех же кандидатов, что и findCandidates
  // (presence -> БД-допуск -> расписание), но БЕЗ скоринга (ScoringService,
  // 1 запрос requestCandidate.findMany на кандидата) и БЕЗ подсчёта офферов
  // за сегодня (ещё 1 запрос на кандидата) — обе стадии существуют только
  // ради сортировки итогового списка, а счётчику нужна лишь его длина.
  // Измерено отдельным e2e (matching-online-count-perf.e2e-spec.ts).
  // После пакетной переделки (E11, карточка #28) оба пути стоят
  // фиксированного числа запросов независимо от N: полный конвейер — 5
  // (эксперты, исключения расписания, дни расписания, скоринг, офферы за
  // сегодня), этот — 3. При потолке ТЗ §6 (до 500 онлайн,
  // экран поиска опрашивает эндпоинт раз в 10с у каждого клиента) разница
  // не разовая, а на каждый такой опрос.
  //
  // where-условие ниже дословно повторяет findCandidates — сознательно:
  // findCandidates обслуживает боевой путь матчинга и покрыт спеками E3,
  // трогать его ради дедупликации здесь избыточный риск ради условий,
  // которые в обоих методах должны совпадать 1:1 (иначе счётчик и реальный
  // подбор разойдутся в том, кого считают "подходящим").
  async countCandidates(params: FindCandidatesParams): Promise<number> {
    const { topicSlug, format, excludeExpertIds = [], urgentOnly } = params;

    const availableIds = await this.presence.listFresh();
    const candidateIds = availableIds.filter(
      (id) => !excludeExpertIds.includes(id),
    );
    if (candidateIds.length === 0) return 0;

    const experts = await this.prisma.expert.findMany({
      where: {
        id: { in: candidateIds },
        verificationStatus: 'VERIFIED',
        isBlocked: false,
        workStatus: 'ACCEPTING',
        formats: { has: format },
        topics: { some: { topic: { slug: topicSlug } } },
        ...(urgentOnly ? { acceptsUrgent: true } : {}),
      },
      select: { id: true },
    });
    if (experts.length === 0) return 0;

    const now = this.clock.now();
    const allowed = await this.schedule.filterWithinSchedule(
      experts.map((e) => e.id),
      now,
    );
    return allowed.size;
  }

  private startOfAlmatyDay(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ymd = formatter.format(date); // YYYY-MM-DD в Asia/Almaty
    // Asia/Almaty = UTC+5, без переходов на летнее время.
    return new Date(`${ymd}T00:00:00+05:00`);
  }
}
