// Выбор камеры и микрофона перед сессией (E14, задача 4).
//
// В прототипе такого экрана НЕТ — он показывает уже идущий разговор.
// Экран добавлен потому, что на десктопе устройств несколько, и «меня не
// слышно» — самая частая поломка видеозвонка. Порт устройств мокается:
// виджет-тест не трогает железо (тот же приём, что AudioPort в E13).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_expert/features/session/state/media_devices.dart';
import 'package:app_expert/features/session/ui/device_picker.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class _FakeDevices implements MediaDevicesPort {
  _FakeDevices(this._cams, this._mics);

  final List<MediaDeviceInfo> _cams;
  final List<MediaDeviceInfo> _mics;
  bool asked = false;

  @override
  Future<List<MediaDeviceInfo>> cameras() async => _cams;

  @override
  Future<List<MediaDeviceInfo>> microphones() async => _mics;

  @override
  Future<bool> requestPermission() async {
    asked = true;
    return _cams.isNotEmpty || _mics.isNotEmpty;
  }
}

Widget _wrap(MediaDevicesPort port, {VoidCallback? onReady}) => ProviderScope(
  overrides: [mediaDevicesPortProvider.overrideWithValue(port)],
  child: MaterialApp(
    locale: const Locale('ru'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: DevicePicker(onReady: onReady ?? () {})),
  ),
);

void main() {
  testWidgets('показывает списки камер и микрофонов', (tester) async {
    final port = _FakeDevices(
      const [
        MediaDeviceInfo(id: 'cam1', label: 'FaceTime HD'),
        MediaDeviceInfo(id: 'cam2', label: 'Logitech C920'),
      ],
      const [MediaDeviceInfo(id: 'mic1', label: 'Встроенный микрофон')],
    );

    await tester.pumpWidget(_wrap(port));
    await tester.pumpAndSettle();

    expect(find.text('Logitech C920'), findsOneWidget);
    expect(find.text('Встроенный микрофон'), findsOneWidget);
  });

  testWidgets('устройств нет — объяснение и повтор, а не пустой экран', (
    tester,
  ) async {
    final port = _FakeDevices(const [], const []);

    await tester.pumpWidget(_wrap(port));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-devices-empty')), findsOneWidget);
    await tester.tap(find.byKey(const Key('sq-devices-retry')));
    await tester.pumpAndSettle();
    expect(port.asked, isTrue);
  });

  testWidgets('кнопка входа зовёт onReady', (tester) async {
    var ready = false;
    final port = _FakeDevices(
      const [MediaDeviceInfo(id: 'cam1', label: 'Камера')],
      const [MediaDeviceInfo(id: 'mic1', label: 'Микрофон')],
    );

    await tester.pumpWidget(_wrap(port, onReady: () => ready = true));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-devices-join')));
    await tester.pumpAndSettle();

    expect(ready, isTrue);
  });

  testWidgets('выбранное устройство запоминается в состоянии', (tester) async {
    final port = _FakeDevices(
      const [
        MediaDeviceInfo(id: 'cam1', label: 'Камера 1'),
        MediaDeviceInfo(id: 'cam2', label: 'Камера 2'),
      ],
      const [MediaDeviceInfo(id: 'mic1', label: 'Микрофон')],
    );

    await tester.pumpWidget(_wrap(port));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-device-cam-cam2')));
    await tester.pumpAndSettle();

    final context = tester.element(find.byType(DevicePicker));
    final container = ProviderScope.containerOf(context);
    expect(container.read(selectedCameraProvider), 'cam2');
  });
}
