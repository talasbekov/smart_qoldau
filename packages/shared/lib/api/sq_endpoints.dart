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

  /// Документы верификации эксперта (E7 задача 5).
  static const expertsMeDocuments = '/experts/me/documents';
  static const expertsMeDocumentsSubmit = '/experts/me/documents/submit';
  static String expertsMeDocumentByType(String type) =>
      '/experts/me/documents/$type';

  /// Фото профиля эксперта (E7 задача 6): `POST` — загрузить (на
  /// модерацию), `DELETE` — удалить.
  static const expertsMePhoto = '/experts/me/photo';
  static String expertById(String id) => '/experts/$id';
  static String expertReviews(String id) => '/experts/$id/reviews';

  /// Свои отзывы эксперта с `id` каждого отзыва (E7 задача 15): публичный
  /// [expertReviews] анонимен и идентификатор не отдаёт, а [reviewReply]/
  /// [reviewComplaint] без него не вызвать.
  static const expertsMeReviews = '/experts/me/reviews';
  static String reviewReply(String id) => '/reviews/$id/reply';
  static String reviewComplaint(String id) => '/reviews/$id/complaint';

  /// Слоты для записи (E6b).
  static String expertSlots(String id) => '/experts/$id/slots';

  /// Расписание и исключения эксперта (E7 задача 7): еженедельное
  /// расписание, приём срочных запросов, и дневные исключения (выходные,
  /// нестандартное время).
  static const expertsMeSchedule = '/experts/me/schedule';
  static const expertsMeAvailability = '/experts/me/availability';
  static const expertsMeScheduleExceptions = '/experts/me/schedule/exceptions';
  static String expertsMeScheduleExceptionByDate(String date) =>
      '/experts/me/schedule/exceptions/$date';

  /// Офферы эксперта (E7 задача 9): активные PENDING-офферы,
  /// принятие/отклонение.
  static const expertsMeOffers = '/experts/me/offers';
  static String offerAccept(String offerId) => '/offers/$offerId/accept';
  static String offerDecline(String offerId) => '/offers/$offerId/decline';

  /// Доход, баланс и выплаты эксперта (E7 задача 14).
  static const expertsMeEarnings = '/experts/me/earnings';
  static const expertsMeBalance = '/experts/me/balance';
  static const payouts = '/payouts';

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

  /// Завершение консультации экспертом и его приватные заметки (E7 задача
  /// 13).
  static String consultationComplete(String id) => '/consultations/$id/complete';
  static String consultationNote(String id) => '/consultations/$id/note';

  // --- отзывы ---
  static String reviewById(String id) => '/reviews/$id';

  /// Запись к специалисту на слот (E6b).
  static const String bookings = '/bookings';

  // --- способы оплаты ---
  static const paymentMethods = '/payment-methods';

  // --- Premium (E12) ---
  static const premium = '/premium';
  static const premiumSubscribe = '/premium/subscribe';
  static const premiumCancel = '/premium/cancel';
  static String paymentMethodById(String id) => '/payment-methods/$id';

  // --- уведомления, устройства, локаль ---
  static const notifications = '/notifications';
  static const notificationsRead = '/notifications/read';
  static const devices = '/devices';
  static const meLocale = '/me/locale';

  // --- аккаунт ---
  /// `DELETE` — удаление своего аккаунта и данных (ТЗ §5.1).
  static const me = '/me';

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
    ('GET', expertsMeDocuments),
    ('POST', '/experts/me/documents/{type}'),
    ('POST', expertsMeDocumentsSubmit),
    ('POST', expertsMePhoto),
    ('DELETE', expertsMePhoto),
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
    ('GET', expertsMeReviews),
    ('POST', '/reviews/{id}/reply'),
    ('POST', '/reviews/{id}/complaint'),
    ('GET', paymentMethods),
    ('POST', paymentMethods),
    ('DELETE', '/payment-methods/{id}'),
    ('GET', premium),
    ('POST', premiumSubscribe),
    ('POST', premiumCancel),
    ('GET', notifications),
    ('POST', notificationsRead),
    ('POST', devices),
    ('DELETE', devices),
    ('PATCH', meLocale),
    ('DELETE', me),
    ('POST', tickets),
    ('GET', tickets),
    ('GET', '/tickets/{id}'),
    ('GET', matchingOnlineCount),
    ('GET', expertsMeSchedule),
    ('PUT', expertsMeSchedule),
    ('PATCH', expertsMeAvailability),
    ('GET', expertsMeScheduleExceptions),
    ('PUT', '/experts/me/schedule/exceptions/{date}'),
    ('DELETE', '/experts/me/schedule/exceptions/{date}'),
    ('GET', expertsMeOffers),
    ('POST', '/offers/{offerId}/accept'),
    ('POST', '/offers/{offerId}/decline'),
    ('POST', '/consultations/{id}/complete'),
    ('GET', '/consultations/{id}/note'),
    ('PUT', '/consultations/{id}/note'),
    ('GET', expertsMeEarnings),
    ('GET', expertsMeBalance),
    ('POST', payouts),
    ('GET', payouts),
  ];

  /// Исключены из проверки контрактным тестом, потому что бэкенд ещё не
  /// реализует соответствующий путь. Задача 9 эпика E6 реализовала
  /// `/matching/online-count` — исключений больше нет.
  static const Set<(String method, String path)> excludedFromContractTest =
      {};
}
