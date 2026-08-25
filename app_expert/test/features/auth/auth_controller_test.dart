// Юнit-тесты AuthController на моке SqApi (mocktail) — сеть полностью
// заменена, а хранилище — фейковым SecureStore в памяти (тот же приём, что
// в app_client/test/features/auth/auth_controller_test.dart: платформенный
// flutter_secure_storage в `flutter test` без подмены канала не отвечает).
//
// В отличие от app_client, у эксперта НЕТ гостевого режима: `AuthState` не
// содержит `AuthGuest`, а `AuthController` не имеет метода
// `continueAsGuest()` вовсе — анкета онбординга (следующие задачи) требует
// полноценной регистрации по телефону. Отсутствие метода проверяется самим
// фактом компиляции этого файла: ни один тест ниже его не вызывает и не
// может вызвать.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/core/providers.dart';
import 'package:app_expert/core/token_store.dart';
import 'package:app_expert/features/auth/state/auth_controller.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

class _ThrowingSecureStore implements SecureStore {
  @override
  Future<String?> read(String key) async =>
      throw Exception('keystore invalidated');

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async =>
      throw Exception('keystore invalidated');
}

Tokens _tokens() => const Tokens(
  accessToken: 'access',
  refreshToken: 'refresh',
  user: AuthUser(id: 'e1', phone: '+77011234567', isGuest: false),
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

    test(
      'при сохранённых токенах эксперта даёт AuthRegistered',
      () async {
        final store = _FakeSecureStore();
        await TokenStore(store).write(_tokens());
        final container = _makeContainer(api: MockSqApi(), store: store);

        await container.read(authControllerProvider.notifier).restore();

        final state = container.read(authControllerProvider).value;
        expect(state, isA<AuthRegistered>());
        expect((state as AuthRegistered).user.isGuest, isFalse);
      },
    );

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

  group('AuthController.verifyCode', () {
    test(
      'при SMS_CODE_INVALID оставляет состояние прежним и пробрасывает ApiException',
      () async {
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
      },
    );

    test(
      'успешный вызов пишет токены в TokenStore и переводит в AuthRegistered',
      () async {
        final api = MockSqApi();
        final tokens = _tokens();
        when(
          () => api.verifyCode(any(), any()),
        ).thenAnswer((_) async => tokens);
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
      await tokenStore.write(_tokens());
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
    test(
      'принудительный разлогин (тик сигнала из core) переводит контроллер в AuthAnonymous',
      () async {
        final store = _FakeSecureStore();
        await TokenStore(store).write(_tokens());
        final container = _makeContainer(api: MockSqApi(), store: store);
        await container.read(authControllerProvider.notifier).restore();
        expect(
          container.read(authControllerProvider).value,
          isA<AuthRegistered>(),
          reason: 'предусловие: сессия действительно восстановлена',
        );

        container.read(sessionInvalidatedProvider.notifier).state++;

        expect(
          container.read(authControllerProvider).value,
          isA<AuthAnonymous>(),
        );
      },
    );
  });
}
