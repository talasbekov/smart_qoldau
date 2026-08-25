// Юнит-тесты `notificationRoute()` — разбора маршрута по типу уведомления.
//
// Задача 2 (E7): раньше эта логика проверялась ТОЛЬКО косвенно, через
// `push_bootstrap_test.dart` (реальная `notificationRoute()` была вшита в
// `PushBootstrap`). Задача 2 вынесла `PushBootstrap` в `shared` и завела там
// seam-провайдер `pushRouteResolverProvider`, а `push_bootstrap_test.dart`
// (тоже переехавший в `shared`) стал проверять фейковым резолвером само
// поведение `PushBootstrap` (что он вообще спрашивает маршрут у seam'а), а
// не таблицу маршрутов `app_client`. Чтобы не потерять покрытие реальной
// `notificationRoute()` (используется и тайлом центра уведомлений, и
// оверрайдом `pushRouteResolverProvider` в `main.dart`), она проверяется
// здесь напрямую.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/notifications/ui/notification_tile.dart';

AppNotification _notification({
  required String type,
  Map<String, dynamic> data = const {},
}) => AppNotification(
  id: 'n1',
  type: type,
  title: 'Заголовок',
  body: 'Текст',
  data: data,
  readAt: null,
  createdAt: DateTime(2026, 8, 25),
);

void main() {
  test('chat.message с consultationId ведёт в сессию', () {
    final route = notificationRoute(
      _notification(type: 'chat.message', data: {'consultationId': 'c1'}),
    );
    expect(route, RoutePaths.session('c1'));
  });

  test('chat.message без consultationId никуда не ведёт', () {
    expect(notificationRoute(_notification(type: 'chat.message')), isNull);
  });

  test('consultation.cancelled и consultation.completed ведут в список консультаций', () {
    expect(
      notificationRoute(_notification(type: 'consultation.cancelled')),
      RoutePaths.consultations,
    );
    expect(
      notificationRoute(_notification(type: 'consultation.completed')),
      RoutePaths.consultations,
    );
  });

  test('ticket.replied с ticketId ведёт в поддержку', () {
    final route = notificationRoute(
      _notification(type: 'ticket.replied', data: {'ticketId': 't1'}),
    );
    expect(route, RoutePaths.support);
  });

  test('ticket.replied без ticketId никуда не ведёт', () {
    expect(notificationRoute(_notification(type: 'ticket.replied')), isNull);
  });

  test('неизвестный тип (например, экспертный) никуда не ведёт и не падает', () {
    // Экспертные типы (offer.*, earning.*, payout.*, verification.*)
    // клиенту по контракту не приходят — но переживать их обязаны.
    expect(notificationRoute(_notification(type: 'payout.updated')), isNull);
  });
}
