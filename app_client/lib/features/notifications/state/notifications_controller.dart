/// Центр уведомлений: страница, счётчик непрочитанных, регистрация
/// устройства.
library;

import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io' show Platform;

import 'package:flutter/widgets.dart' show Locale;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/locale_controller.dart';
import '../../../core/providers.dart';
import '../../../core/push_token_source.dart';
import '../../auth/state/auth_controller.dart';
import '../data/notifications_repository.dart';

/// Размер страницы центра уведомлений.
const notificationsPageSize = 20;

/// Сколько ждём после реалтайм-события, прежде чем перечитать первую
/// страницу: бэкенд легко шлёт несколько уведомлений подряд (оффер, чат,
/// оплата), а перезапрашивать список на каждое — три круга сети вместо
/// одного.
const notificationsRefreshDebounce = Duration(milliseconds: 500);

class NotificationsState {
  const NotificationsState({
    required this.items,
    required this.unreadCount,
    this.loadingMore = false,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final bool loadingMore;

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    bool? loadingMore,
  }) => NotificationsState(
    items: items ?? this.items,
    unreadCount: unreadCount ?? this.unreadCount,
    loadingMore: loadingMore ?? this.loadingMore,
  );
}

class NotificationsController extends AsyncNotifier<NotificationsState> {
  StreamSubscription<SqEvent>? _events;
  Timer? _debounce;

  @override
  FutureOr<NotificationsState> build() {
    final events = ref.watch(sqEventsProvider);
    _events = events.stream.listen(_onEvent);
    ref.onDispose(() {
      _events?.cancel();
      _debounce?.cancel();
    });

    return _loadFirstPage();
  }

  Future<NotificationsState> _loadFirstPage() async {
    final page = await ref
        .read(notificationsRepositoryProvider)
        .page(take: notificationsPageSize, skip: 0);
    return NotificationsState(
      items: page.items,
      unreadCount: page.unreadCount,
    );
  }

  /// В событии `notification.new` приходит только `{id, type}` — тела нет,
  /// поэтому вставить запись в список нельзя, только перечитать страницу.
  void _onEvent(SqEvent event) {
    if (event is! NotificationNew) return;
    _debounce?.cancel();
    _debounce = Timer(notificationsRefreshDebounce, refresh);
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_loadFirstPage);
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || current.loadingMore) return;

    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await ref
          .read(notificationsRepositoryProvider)
          .page(take: notificationsPageSize, skip: current.items.length);
      final ids = current.items.map((item) => item.id).toSet();
      state = AsyncData(
        current.copyWith(
          items: [
            ...current.items,
            ...page.items.where((item) => !ids.contains(item.id)),
          ],
          unreadCount: page.unreadCount,
          loadingMore: false,
        ),
      );
    } catch (error) {
      developer.log(
        'догрузка уведомлений не удалась: ${error.runtimeType}',
        name: 'NotificationsController',
      );
      state = AsyncData(current.copyWith(loadingMore: false));
    }
  }

  /// Отмечает конкретные уведомления прочитанными.
  Future<void> markRead(List<String> ids) async {
    if (ids.isEmpty) return;
    final current = state.valueOrNull;
    if (current == null) return;

    await ref.read(notificationsRepositoryProvider).markRead(ids: ids);
    final now = DateTime.now();
    var read = 0;
    final items = [
      for (final item in current.items)
        if (ids.contains(item.id) && item.readAt == null)
          () {
            read++;
            return item.copyWith(readAt: now);
          }()
        else
          item,
    ];
    state = AsyncData(
      current.copyWith(
        items: items,
        unreadCount: (current.unreadCount - read).clamp(0, current.unreadCount),
      ),
    );
  }

  /// «Прочитать все». Запрос уходит БЕЗ `ids` — по контракту бэкенда это и
  /// значит «все свои»; пустой список означал бы «ни одного».
  Future<void> markAllRead() async {
    final current = state.valueOrNull;
    if (current == null) return;

    await ref.read(notificationsRepositoryProvider).markRead();
    final now = DateTime.now();
    state = AsyncData(
      current.copyWith(
        items: [
          for (final item in current.items)
            item.readAt == null ? item.copyWith(readAt: now) : item,
        ],
        unreadCount: 0,
      ),
    );
  }
}

final notificationsControllerProvider =
    AsyncNotifierProvider<NotificationsController, NotificationsState>(
      NotificationsController.new,
    );

/// Счётчик для бейджа. `0`, пока список не загружен — бейдж просто не
/// показывается, а не мигает случайным числом.
final unreadCountProvider = Provider<int>(
  (ref) =>
      ref.watch(notificationsControllerProvider).valueOrNull?.unreadCount ?? 0,
);

/// Регистрирует устройство для пушей и перерегистрирует его при смене
/// языка интерфейса.
class DeviceRegistrar {
  DeviceRegistrar(this._ref) {
    // Локаль устройства — часть регистрации (бэкенд шлёт пуш на языке
    // пользователя), поэтому её смена требует повторного upsert'а.
    _ref.listen<Locale>(localeControllerProvider, (previous, next) {
      if (previous == next) return;
      register();
    });
  }

  final Ref _ref;

  /// Регистрирует устройство, если push-токен есть. Ошибки не бросает:
  /// это фоновая операция, из-за которой не должен падать экран запуска.
  Future<void> register() async {
    try {
      final token = await _ref.read(pushTokenSourceProvider).token();
      if (token == null || token.isEmpty) return;

      await _ref
          .read(notificationsRepositoryProvider)
          .registerDevice(
            platform: Platform.isIOS ? 'ios' : 'android',
            token: token,
            locale: localeToApi(_ref.read(localeControllerProvider)),
          );
    } catch (error) {
      developer.log(
        'устройство не зарегистрировано: ${error.runtimeType}',
        name: 'DeviceRegistrar',
      );
    }
  }
}

final deviceRegistrarProvider = Provider<DeviceRegistrar>(
  (ref) => DeviceRegistrar(ref),
);

/// Запускает регистрацию устройства, как только у клиента появляется
/// сессия. Раньше нельзя: `POST /devices` требует JWT и до входа ответил бы
/// 401. Наблюдается из `app.dart`.
final deviceRegistrationProvider = Provider<void>((ref) {
  ref.listen<bool>(hasSessionProvider, (previous, next) {
    if (!next || previous == true) return;
    ref.read(deviceRegistrarProvider).register();
  }, fireImmediately: true);
});
