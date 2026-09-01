/// Выбор камеры и микрофона перед входом в сессию (E14).
///
/// Экрана нет в прототипе — он показывает уже идущий разговор. Добавлен
/// потому, что на десктопе у человека бывает три микрофона и две камеры,
/// и «меня не слышно» — самая частая поломка видеозвонка. Разбираться с
/// этим посреди консультации, когда на том конце ждёт человек в тяжёлом
/// состоянии, — худший момент из возможных.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/media_devices.dart';

class DevicePicker extends ConsumerWidget {
  const DevicePicker({super.key, required this.onReady});

  final VoidCallback onReady;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final cameras = ref.watch(camerasProvider);
    final microphones = ref.watch(microphonesProvider);

    final camList = cameras.valueOrNull ?? const <MediaDeviceInfo>[];
    final micList = microphones.valueOrNull ?? const <MediaDeviceInfo>[];
    final loading = cameras.isLoading || microphones.isLoading;

    if (loading) {
      return const Center(child: SqLoader());
    }

    if (camList.isEmpty && micList.isEmpty) {
      return Center(
        key: const Key('sq-devices-empty'),
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.l),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                l10n.devicesNotFound,
                textAlign: TextAlign.center,
                style: SqTypography.body,
              ),
              const SizedBox(height: SqSpacing.m),
              SqButton(
                key: const Key('sq-devices-retry'),
                label: l10n.actionRetry,
                onPressed: () async {
                  await ref.read(mediaDevicesPortProvider).requestPermission();
                  ref.invalidate(camerasProvider);
                  ref.invalidate(microphonesProvider);
                },
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.devicesTitle, style: SqTypography.h2),
          const SizedBox(height: SqSpacing.l),
          _DeviceGroup(
            title: l10n.devicesCamera,
            devices: camList,
            selected:
                ref.watch(selectedCameraProvider) ?? camList.firstOrNull?.id,
            keyPrefix: 'cam',
            onSelect: (id) =>
                ref.read(selectedCameraProvider.notifier).state = id,
          ),
          const SizedBox(height: SqSpacing.m),
          _DeviceGroup(
            title: l10n.devicesMicrophone,
            devices: micList,
            selected:
                ref.watch(selectedMicrophoneProvider) ??
                micList.firstOrNull?.id,
            keyPrefix: 'mic',
            onSelect: (id) =>
                ref.read(selectedMicrophoneProvider.notifier).state = id,
          ),
          const SizedBox(height: SqSpacing.xl),
          SqButton(
            key: const Key('sq-devices-join'),
            label: l10n.devicesJoin,
            onPressed: onReady,
          ),
        ],
      ),
    );
  }
}

class _DeviceGroup extends StatelessWidget {
  const _DeviceGroup({
    required this.title,
    required this.devices,
    required this.selected,
    required this.keyPrefix,
    required this.onSelect,
  });

  final String title;
  final List<MediaDeviceInfo> devices;
  final String? selected;
  final String keyPrefix;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: SqTypography.title),
        const SizedBox(height: SqSpacing.s),
        // RadioGroup вместо устаревших groupValue/onChanged на каждом
        // элементе — актуальный API Flutter.
        RadioGroup<String>(
          groupValue: selected,
          onChanged: (value) => value == null ? null : onSelect(value),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final device in devices)
                RadioListTile<String>(
                  key: Key('sq-device-$keyPrefix-${device.id}'),
                  value: device.id,
                  title: Text(device.label, style: SqTypography.body),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
            ],
          ),
        ),
      ],
    );
  }
}
