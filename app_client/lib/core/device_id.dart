/// Идентификатор устройства для гостевого профиля (device-scoped, Р-22).
library;

import 'package:uuid/uuid.dart';

import 'token_store.dart' show SecureStore;

/// Ключ, под которым идентификатор устройства хранится в [SecureStore].
const deviceIdKey = 'sq.device_id';

/// Возвращает UUID v4 идентификатора устройства.
///
/// Создаётся один раз при первом обращении и кладётся в [store]; повторные
/// вызовы (в том числе после перезапуска приложения) читают то же самое
/// значение из хранилища — гостевой профиль привязан к устройству (Р-22) и
/// не должен плодиться заново при каждом гостевом входе.
Future<String> deviceId(SecureStore store, {Uuid uuid = const Uuid()}) async {
  final existing = await store.read(deviceIdKey);
  if (existing != null) {
    return existing;
  }
  final created = uuid.v4();
  await store.write(deviceIdKey, created);
  return created;
}
