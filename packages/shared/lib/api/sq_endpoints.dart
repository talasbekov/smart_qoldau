/// Пути (без префикса `/v1`, который несёт `Dio.baseUrl`) и HTTP-методы
/// бэкенда SmartQoldau, которыми пользуется `SqApi`.
///
/// [contractEndpoints] — источник для `test/api/contract_test.dart`: для
/// каждой пары тест требует наличия соответствующего пути и метода в
/// `docs/openapi.json`.
abstract final class SqEndpoints {
  // --- auth ---
  static const authRequestCode = '/auth/request-code';
  static const authVerifyCode = '/auth/verify-code';
  static const authRefresh = '/auth/refresh';
  static const authGuest = '/auth/guest';
  static const authGuestConvert = '/auth/guest/convert';

  // --- каталог ---
  static const topics = '/topics';
  static const experts = '/experts';
  static const expertsMe = '/experts/me';
  static const expertsMeWorkStatus = '/experts/me/work-status';
  static const expertsMeHeartbeat = '/experts/me/heartbeat';
  static String expertById(String id) => '/experts/$id';
  static String expertReviews(String id) => '/experts/$id/reviews';

  /// Слоты для записи (E6b).
  static String expertSlots(String id) => '/experts/$id/slots';

  // --- избранное ---
  static const favorites = '/favorites';
  static String favoriteExpert(String expertId) => '/favorites/$expertId';

  // --- заявки на подбор эксперта ---
  static const requests = '/requests';
  static String requestById(String id) => '/requests/$id';
  static String requestCancel(String id) => '/requests/$id/cancel';

  static const matchingOnlineCount = '/matching/online-count';

  // --- консультации ---
  static const consultations = '/consultations';
  static String consultationById(String id) => '/consultations/$id';
  static String consultationCancel(String id) => '/consultations/$id/cancel';

  /// Перенос плановой консультации (E6b).
  static String consultationReschedule(String id) =>
      '/consultations/$id/reschedule';
  static String consultationMessages(String id) =>
      '/consultations/$id/messages';
  static String consultationMediaToken(String id) =>
      '/consultations/$id/media-token';
  static String consultationPay(String id) => '/consultations/$id/pay';
  static String consultationPayment(String id) => '/consultations/$id/payment';
  static String consultationReview(String id) => '/consultations/$id/review';

  // --- отзывы ---
  static String reviewById(String id) => '/reviews/$id';

  /// Запись к специалисту на слот (E6b).
  static const String bookings = '/bookings';

  // --- способы оплаты ---
  static const paymentMethods = '/payment-methods';
  static String paymentMethodById(String id) => '/payment-methods/$id';

  // --- уведомления, устройства, локаль ---
  static const notifications = '/notifications';
  static const notificationsRead = '/notifications/read';
  static const devices = '/devices';
  static const meLocale = '/me/locale';

  // --- обращения в поддержку ---
  static const tickets = '/tickets';
  static String ticketById(String id) => '/tickets/$id';

  /// Полный перечень (метод, путь-шаблон) для контрактного теста. Путь —
  /// шаблон в буквальном виде OpenAPI (`{id}`, `{expertId}`), а не
  /// подставленное значение.
  static const List<(String method, String path)> contractEndpoints = [
    ('POST', authRequestCode),
    ('POST', authVerifyCode),
    ('POST', authRefresh),
    ('POST', authGuest),
    ('POST', authGuestConvert),
    ('GET', topics),
    ('GET', experts),
    ('POST', experts),
    ('GET', expertsMe),
    ('PATCH', expertsMe),
    ('PATCH', expertsMeWorkStatus),
    ('POST', expertsMeHeartbeat),
    ('GET', '/experts/{id}'),
    ('GET', '/experts/{id}/reviews'),
    ('GET', '/experts/{id}/slots'),
    ('GET', favorites),
    ('PUT', '/favorites/{expertId}'),
    ('DELETE', '/favorites/{expertId}'),
    ('POST', requests),
    ('GET', '/requests/{id}'),
    ('POST', '/requests/{id}/cancel'),
    ('GET', consultations),
    ('GET', '/consultations/{id}'),
    ('POST', '/consultations/{id}/cancel'),
    ('POST', '/consultations/{id}/reschedule'),
    ('POST', bookings),
    ('GET', '/consultations/{id}/messages'),
    ('POST', '/consultations/{id}/media-token'),
    ('POST', '/consultations/{id}/pay'),
    ('GET', '/consultations/{id}/payment'),
    ('POST', '/consultations/{id}/review'),
    ('DELETE', '/reviews/{id}'),
    ('GET', paymentMethods),
    ('POST', paymentMethods),
    ('DELETE', '/payment-methods/{id}'),
    ('GET', notifications),
    ('POST', notificationsRead),
    ('POST', devices),
    ('DELETE', devices),
    ('PATCH', meLocale),
    ('POST', tickets),
    ('GET', tickets),
    ('GET', '/tickets/{id}'),
    ('GET', matchingOnlineCount),
  ];

  /// Исключены из проверки контрактным тестом, потому что бэкенд ещё не
  /// реализует соответствующий путь. Задача 9 эпика E6 реализовала
  /// `/matching/online-count` — исключений больше нет.
  static const Set<(String method, String path)> excludedFromContractTest =
      {};
}
