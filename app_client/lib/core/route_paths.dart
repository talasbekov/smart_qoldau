/// Пути маршрутов приложения — общая точка правды для `router.dart` и
/// экранов, которым нужно на них переходить (`context.go`/`context.push`).
///
/// Вынесены из `router.dart` в отдельный файл сознательно: `router.dart`
/// импортирует экраны фич, чтобы зарегистрировать их как маршруты, и если
/// бы сами пути жили там же, экранам, которым нужно на них ссылаться
/// (например, `HomeScreen`, зовущему `context.push(RoutePaths.emergency)`),
/// пришлось бы импортировать `router.dart` в ответ — цикл `router →
/// features → router`. `core` (куда допустимо смотреть любой фиче, но не
/// наоборот, см. `core/providers.dart`) — естественное место для путей,
/// которые не принадлежат ни одной фиче.
library;

import 'package:shared/shared.dart';

/// Пути состояний сессии/онбординга, которыми управляет редирект-гард
/// `router.dart` (см. `_redirect`).
abstract final class RoutePaths {
  static const splash = '/splash';
  static const welcome = '/welcome';
  static const onboarding = '/onboarding';
  static const permissions = '/permissions';

  /// Вкладки `ShellRoute` нижней навигации.
  static const home = '/home';
  static const catalog = '/catalog';
  static const consultations = '/consultations';
  static const profile = '/profile';

  /// Поддержка (задача 19). Маршрут заведён раньше экрана: на него
  /// ссылается тайл уведомления `ticket.replied`.
  static const support = '/support';

  /// Конверсия гостя в аккаунт (Р-22, задача 19).
  static const convertGuest = '/profile/convert';

  /// Настройки приложения (задача 19).
  static const settings = '/profile/settings';

  /// Новое обращение в поддержку и карточка обращения (задача 19).
  static const supportNew = '/support/new';
  static const supportTicketPattern = '/support/:id';

  static String supportTicket(String id) => '/support/$id';

  /// Центр уведомлений (задача 18).
  static const notifications = '/notifications';

  /// Детали консультации — вложенный маршрут вкладки «Консультации».
  static const consultationDetailsPattern = '/consultations/:id';

  static String consultationDetails(String id) => '/consultations/$id';

  /// Профиль специалиста и избранное — вложенные маршруты вкладки
  /// «Каталог»: у них есть путь-родитель `/catalog`, поэтому системное
  /// «назад» возвращает во вкладку, а не выбрасывает из приложения.
  static const expertPattern = '/catalog/expert/:id';

  /// Выбор времени записи к специалисту (E6b).
  static const bookingPattern = '/catalog/expert/:id/booking';

  static String booking(String expertId) => '/catalog/expert/$expertId/booking';

  /// Перенос плановой консультации (E6b).
  static const reschedulePattern = '/consultations/:id/reschedule';

  static String reschedule(String id) => '/consultations/$id/reschedule';

  static String expert(String id) => '/catalog/expert/$id';

  static const favorites = '/catalog/favorites';

  /// Экстренный сценарий (БП-02): скрининг «угрожает ли опасность».
  static const emergency = '/emergency';

  /// Экстренный сценарий: экран угрозы (ответ «Да» на скрининге БП-02).
  static const emergencyDanger = '/emergency/danger';

  /// Экстренный сценарий: список горячих линий (эскалация Р-16). Сюда
  /// уводит экран поиска, когда заявка закрылась статусом
  /// `CALLBACK_REQUESTED`.
  static const emergencyHotlines = '/emergency/hotlines';

  /// Экран темы (`?slug=<slug>`): подтверждение темы и выбор формата.
  static const topic = '/topic';

  /// Шаблон маршрута экрана поиска специалиста для `GoRoute.path`.
  static const searchPattern = '/search/:requestId';

  /// Путь экрана поиска по заявке [requestId].
  static String search(String requestId) => '/search/$requestId';

  /// Шаблон маршрута экрана «специалист найден» (задача 12 эпика E6).
  static const foundPattern = '/found/:requestId';

  /// Путь экрана «специалист найден» по заявке [requestId].
  static String found(String requestId) => '/found/$requestId';

  /// Привязанные карты клиента и добавление новой (задача 12).
  /// Premium (E12): тарифы, оформление и отмена подписки.
  static const premium = '/premium';

  static const cards = '/cards';
  static const cardsAdd = '/cards/add';

  /// Шаблон маршрута сессии консультации для регистрации в `GoRoute.path`.
  static const sessionPattern = '/session/:id';

  /// Строит конкретный путь сессии консультации [id] для навигации
  /// (`context.push(RoutePaths.session(id))`).
  static String session(String id) => '/session/$id';

  /// Шаблон маршрута экрана оценки консультации.
  static const reviewPattern = '/review/:id';

  /// Путь экрана оценки консультации [id].
  static String review(String id) => '/review/$id';

  /// Шаблон маршрута звонка (аудио/видео) для регистрации в `GoRoute.path`.
  static const callPattern = '/call/:id';

  /// Путь звонка по консультации [id] в формате [format] — формат едет
  /// query-параметром, потому что это ЗАПРОШЕННЫЙ формат (эскалация), а не
  /// текущее состояние консультации.
  static String call(String id, SessionFormat format) =>
      '/call/$id?format=${format.wireValue}';
}
