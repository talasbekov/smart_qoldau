/// Пути маршрутов приложения эксперта — общая точка правды для
/// `router.dart` и экранов, которым нужно на них переходить.
///
/// Пока покрывает только состояния сессии (см. `router.dart`,
/// `_redirect`) — вкладок и фич ещё нет, их пути появятся в последующих
/// задачах эпика E7.
library;

import 'package:shared/shared.dart';

abstract final class RoutePaths {
  /// Заставка: восстановление сессии при старте приложения.
  static const splash = '/splash';

  /// Вход по телефону — единственный способ попасть в приложение: у
  /// эксперта нет гостевого режима (анкета онбординга требует полноценной
  /// регистрации).
  static const welcome = '/welcome';

  /// Временная точка входа авторизованного эксперта — заполнится
  /// оболочкой с вкладками в последующих задачах.
  static const home = '/home';

  /// Анкета онбординга, шаг 1/2 — профильные поля специалиста (задача 4
  /// эпика E7). Фото и документы верификации — отдельные шаги/задачи
  /// (5/6), сюда не входят.
  static const onboardingProfile = '/onboarding/profile';

  /// Анкета онбординга, шаг 2/2 — выбор тем консультаций.
  static const onboardingTopics = '/onboarding/topics';

  /// Документы верификации (задача 5 эпика E7) — 4 карточки типа
  /// документа, отправка анкеты на проверку.
  static const verificationDocuments = '/verification/documents';

  /// Статус верификации (задача 6 эпика E7) — единственный источник
  /// правды: `ExpertMe`, опрашиваемый раз в 30 с, пока не `VERIFIED`.
  static const verificationStatus = '/verification/status';

  /// Загрузка/удаление фото профиля (задача 6 эпика E7).
  static const verificationPhoto = '/verification/photo';

  /// Еженедельное расписание эксперта (задача 8 эпика E7) — 7 строк дней,
  /// тумблер + рабочие часы/перерыв.
  static const schedule = '/schedule';

  /// Исключения в расписании (задача 8 эпика E7) — календарь на 14 дней
  /// вперёд, тап по дню открывает шторку «выходной / другие часы».
  static const scheduleExceptions = '/schedule/exceptions';

  /// Заявки и консультации (задача 12 эпика E7) — три вкладки: «Заявки»
  /// (офферы), «Идёт сейчас»/«Плановые», «История».
  static const consultations = '/consultations';

  /// Шаблон маршрута сессии консультации (чат) для регистрации в
  /// `GoRoute.path` (задача 13 эпика E7).
  static const sessionPattern = '/session/:id';

  /// Путь сессии консультации [id] — чат.
  static String session(String id) => '/session/$id';

  /// Шаблон маршрута звонка (аудио/видео) для регистрации в `GoRoute.path`.
  static const callPattern = '/call/:id';

  /// Путь звонка по консультации [id] в формате [format] — тот же приём,
  /// что `app_client/lib/core/route_paths.dart`: формат едет
  /// query-параметром, потому что это ЗАПРОШЕННЫЙ формат (эскалация), а не
  /// текущее состояние консультации.
  static String call(String id, SessionFormat format) => '/call/$id?format=${format.wireValue}';
}
