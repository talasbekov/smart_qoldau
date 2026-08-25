/// Экран еженедельного расписания (E7 задача 8): 7 строк дней недели
/// (пн первым, `weekday: 0`), тумблер + выбор рабочих часов/перерыва
/// (`TimeOfDay`-пикеры, конвертация в минуты от полуночи —
/// `startMin = t.hour * 60 + t.minute`). Кнопка «Исключения» ведёт на
/// `ExceptionsScreen` — календарь на 14 дней вперёд.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/schedule_controller.dart';
import 'day_row.dart';

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});

  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  bool _saving = false;
  String? _error;

  ScheduleController get _controller =>
      ref.read(scheduleControllerProvider.notifier);

  TimeOfDay _timeOfDay(int? minutes) {
    final m = minutes ?? 9 * 60;
    return TimeOfDay(hour: m ~/ 60, minute: m % 60);
  }

  Future<void> _pickStart(ScheduleDay day) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeOfDay(day.startMin),
    );
    if (picked == null || !mounted) return;
    final startMin = picked.hour * 60 + picked.minute;
    final endMin = day.endMin ?? startMin + 60;
    _controller.setHours(day.weekday, startMin: startMin, endMin: endMin);
  }

  Future<void> _pickEnd(ScheduleDay day) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeOfDay(day.endMin),
    );
    if (picked == null || !mounted) return;
    final endMin = picked.hour * 60 + picked.minute;
    final startMin = day.startMin ?? (endMin - 60).clamp(0, 1440);
    _controller.setHours(day.weekday, startMin: startMin, endMin: endMin);
  }

  Future<void> _pickBreakStart(ScheduleDay day) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeOfDay(day.breakStart ?? day.startMin),
    );
    if (picked == null || !mounted) return;
    _controller.setBreak(
      day.weekday,
      start: picked.hour * 60 + picked.minute,
      end: day.breakEnd,
    );
  }

  Future<void> _pickBreakEnd(ScheduleDay day) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeOfDay(day.breakEnd ?? day.startMin),
    );
    if (picked == null || !mounted) return;
    _controller.setBreak(
      day.weekday,
      start: day.breakStart,
      end: picked.hour * 60 + picked.minute,
    );
  }

  void _clearBreak(ScheduleDay day) {
    _controller.setBreak(day.weekday, start: null, end: null);
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _controller.save();
    } on ScheduleValidationException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final scheduleAsync = ref.watch(scheduleControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.scheduleScreenTitle),
        actions: [
          IconButton(
            key: const Key('sq-schedule-exceptions'),
            icon: const Icon(Icons.event_busy),
            onPressed: () => context.push(RoutePaths.scheduleExceptions),
          ),
        ],
      ),
      body: scheduleAsync.when(
        loading: () => const SqLoader(),
        error: (error, _) => Center(
          child: SqErrorView(
            text: error is ApiException ? error.message : l10n.errorLoadFailed,
            onRetry: () => ref.invalidate(scheduleControllerProvider),
          ),
        ),
        data: (days) => ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            for (final day in days) ...[
              DayRow(
                day: day,
                onToggle: () => _controller.toggleDay(day.weekday),
                onPickStart: () => _pickStart(day),
                onPickEnd: () => _pickEnd(day),
                onPickBreakStart: () => _pickBreakStart(day),
                onPickBreakEnd: () => _pickBreakEnd(day),
                onClearBreak: () => _clearBreak(day),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            if (_error != null) ...[
              Text(
                _error!,
                style: SqTypography.body.copyWith(color: SqColors.danger),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            SqButton(
              key: const Key('sq-schedule-save'),
              label: l10n.actionSave,
              loading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
