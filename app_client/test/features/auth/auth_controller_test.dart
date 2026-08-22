// Юнит-тесты AuthController на моке SqApi (mocktail) — сеть полностью
// заменена, а хранилище — фейковым SecureStore в памяти (см. обоснование
// выбора в отчёте задачи 5: платформенный flutter_secure_storage в
// `flutter test` без подмены канала не отвечает, а сам мок канала рискует
// «протечь» на другие тесты файла, как это уже было в задаче 2 с
// path_provider).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/state/auth_controller.dart';

class MockSqApi extends Mock implements SqApi {}

/// Секьюрное хранилище в памяти для тестов — реализует тот же узкий
/// [SecureStore], который в приложении оборачивает `flutter_secure_storage`.
class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

/// Имитирует недоступное/повреждённое хранилище (инвалидация Android
/// keystore, устаревший формат сохранённых данных) — любое чтение бросает.
class _ThrowingSecureStore implements SecureStore {
  @override
  Future<String?> read(String key) async =>
      throw Exception('keystore invalidated');

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async {}
}

Tokens _tokens({required bool isGuest}) => Tokens(
  accessToken: 'access-$isGuest',
  refreshToken: 'refresh-$isGuest',
  user: AuthUser(
    id: 'u1',
    phone: isGuest ? null : '+77011234567',
    isGuest: isGuest,
  ),
);

ProviderContainer _makeContainer({required SqApi api, SecureStore? store}) {
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(store ?? _FakeSecureStore()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('AuthController.restore', () {
    test('при пустом хранилище даёт AuthAnonymous', () async {
      final container = _makeContainer(api: MockSqApi());

      await container.read(authControllerProvider.notifier).restore();

      expect(
        container.read(authControllerProvider).value,
        isA<AuthAnonymous>(),
      );
    });

    test('при сохранённых токенах гостя даёт AuthGuest', () async {
      final store = _FakeSecureStore();
      await TokenStore(store).write(_tokens(isGuest: true));
      final container = _makeContainer(api: MockSqApi(), store: store);

      await container.read(authControllerProvider.notifier).restore();

      final state = container.read(authControllerProvider).value;
      expect(state, isA<AuthGuest>());
      expect((state as AuthGuest).user.isGuest, isTrue);
    });

    test('при сохранённых токенах зарегистрированного пользователя даёт AuthRegistered', () async {
      final store = _FakeSecureStore();
      await TokenStore(store).write(_tokens(isGuest: false));
      final container = _makeContainer(api: MockSqApi(), store: store);

      await container.read(authControllerProvider.notifier).restore();

      final state = container.read(authControllerProvider).value;
      expect(state, isA<AuthRegistered>());
      expect((state as AuthRegistered).user.isGuest, isFalse);
    });

    test(
      'при ошибке чтения хранилища не виснет и даёт AuthAnonymous',
      () async {
        final container = _makeContainer(
          api: MockSqApi(),
          store: _ThrowingSecureStore(),
        );

        await container.read(authControllerProvider.notifier).restore();

        expect(
          container.read(authControllerProvider).value,
          isA<AuthAnonymous>(),
        );
      },
    );
  });

  group('AuthController.continueAsGuest', () {
    test(
      'шлёт POST /auth/guest с одним и тем же deviceId при повторном вызове',
      () async {
        final api = MockSqApi();
        final capturedIds = <String>[];
        when(() => api.guestLogin(any())).thenAnswer((invocation) async {
          capturedIds.add(invocation.positionalArguments[0] as String);
          return _tokens(isGuest: true);
        });
        final container = _makeContainer(api: api);

        await container.read(authControllerProvider.notifier).continueAsGuest();
        await container.read(authControllerProvider.notifier).continueAsGuest();

        expect(capturedIds, hasLength(2));
        expect(capturedIds[0], isNotEmpty);
        expect(
          capturedIds[1],
          capturedIds[0],
          reason:
              'второй вызов не должен был сгенерировать новый UUID устройства',
        );
      },
    );
  });

  group('AuthController.verifyCode', () {
    test('при SMS_CODE_INVALID оставляет состояние прежним и пробрасывает ApiException', () async {
      final api = MockSqApi();
      when(() => api.verifyCode(any(), any())).thenThrow(
        const ApiException(ApiErrorCode.smsCodeInvalid, 'bad code', 400),
      );
      final container = _makeContainer(api: api);
      await container.read(authControllerProvider.notifier).restore();
      final before = container.read(authControllerProvider).value;

      await expectLater(
        container
            .read(authControllerProvider.notifier)
            .verifyCode('+77011234567', '0000'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.smsCodeInvalid,
          ),
        ),
      );

      expect(container.read(authControllerProvider).value, same(before));
    });

    test(
      'успешный вызов пишет токены в TokenStore и переводит в AuthRegistered',
      () async {
        final api = MockSqApi();
        final tokens = _tokens(isGuest: false);
        when(() => api.verifyCode(any(), any()))
            .thenAnswer((_) async => tokens);
        final store = _FakeSecureStore();
        final container = _makeContainer(api: api, store: store);

        await container
            .read(authControllerProvider.notifier)
            .verifyCode('+77011234567', '1234');

        final saved = await TokenStore(store).read();
        expect(saved, isNotNull);
        expect(saved!.accessToken, tokens.accessToken);
        expect(
          container.read(authControllerProvider).value,
          isA<AuthRegistered>(),
        );
      },
    );
  });

  group('AuthController.logout', () {
    test('чистит TokenStore и даёт AuthAnonymous', () async {
      final store = _FakeSecureStore();
      final tokenStore = TokenStore(store);
      await tokenStore.write(_tokens(isGuest: true));
      final container = _makeContainer(api: MockSqApi(), store: store);
      await container.read(authControllerProvider.notifier).restore();

      await container.read(authControllerProvider.notifier).logout();

      expect(
        container.read(authControllerProvider).value,
        isA<AuthAnonymous>(),
      );
      expect(await tokenStore.read(), isNull);
    });
  });

  group('sessionInvalidatedProvider', () {
    test('принудительный разлогин (тик сигнала из core) переводит контроллер в AuthAnonymous', () async {
      final store = _FakeSecureStore();
      await TokenStore(store).write(_tokens(isGuest: true));
      final container = _makeContainer(api: MockSqApi(), store: store);
      await container.read(authControllerProvider.notifier).restore();
      expect(
        container.read(authControllerProvider).value,
        isA<AuthGuest>(),
        reason: 'предусловие: сессия действительно восстановлена',
      );

      container.read(sessionInvalidatedProvider.notifier).state++;

      expect(
        container.read(authControllerProvider).value,
        isA<AuthAnonymous>(),
      );
    });
  });
}
