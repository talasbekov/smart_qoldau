/// Медиаустройства для веб-кабинета (E14).
///
/// Порт, а не прямой вызов LiveKit: виджет-тесты проверяют поведение
/// экрана, а не работу браузерного API — камеры в тестовой среде нет.
/// Тот же приём, что `AudioPort` в E13.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart' as lk;

class MediaDeviceInfo {
  const MediaDeviceInfo({required this.id, required this.label});

  final String id;
  final String label;
}

abstract class MediaDevicesPort {
  Future<List<MediaDeviceInfo>> cameras();
  Future<List<MediaDeviceInfo>> microphones();

  /// Запрашивает доступ и возвращает, дали ли его. Без разрешения
  /// браузер отдаёт устройства без названий — список из трёх пустых
  /// строк человеку не поможет.
  Future<bool> requestPermission();
}

class LiveKitMediaDevices implements MediaDevicesPort {
  const LiveKitMediaDevices();

  Future<List<MediaDeviceInfo>> _byKind(String kind) async {
    final devices = await lk.Hardware.instance.enumerateDevices(type: kind);
    return devices
        .map((d) => MediaDeviceInfo(id: d.deviceId, label: d.label))
        .where((d) => d.label.isNotEmpty)
        .toList();
  }

  @override
  Future<List<MediaDeviceInfo>> cameras() => _byKind('videoinput');

  @override
  Future<List<MediaDeviceInfo>> microphones() => _byKind('audioinput');

  @override
  Future<bool> requestPermission() async {
    try {
      final devices = await lk.Hardware.instance.enumerateDevices();
      return devices.any((d) => d.label.isNotEmpty);
    } catch (_) {
      return false;
    }
  }
}

final mediaDevicesPortProvider = Provider<MediaDevicesPort>(
  (ref) => const LiveKitMediaDevices(),
);

/// Выбор запоминается на время работы кабинета: переспрашивать перед
/// каждой консультацией — раздражать человека, у которого шесть сессий в
/// день.
final selectedCameraProvider = StateProvider<String?>((ref) => null);
final selectedMicrophoneProvider = StateProvider<String?>((ref) => null);

final camerasProvider = FutureProvider.autoDispose<List<MediaDeviceInfo>>(
  (ref) => ref.watch(mediaDevicesPortProvider).cameras(),
);
final microphonesProvider = FutureProvider.autoDispose<List<MediaDeviceInfo>>(
  (ref) => ref.watch(mediaDevicesPortProvider).microphones(),
);
