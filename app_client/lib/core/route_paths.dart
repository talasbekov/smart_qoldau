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
  static const cards = '/cards';
  static const cardsAdd = '/cards/add';

  /// Шаблон маршрута сессии консультации для регистрации в `GoRoute.path`.
  static const sessionPattern = '/session/:id';

  /// Строит конкретный путь сессии консультации [id] для навигации
  /// (`context.push(RoutePaths.session(id))`).
  static String session(String id) => '/session/$id';
}
