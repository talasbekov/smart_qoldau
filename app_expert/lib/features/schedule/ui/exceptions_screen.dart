/// Исключения в расписании (E7 задача 8): календарь на 14 дней вперёд —
/// тот же горизонт, что `expertSlots` клиента (`bookingHorizonDays` в
/// `app_client/lib/features/booking/state/slots_controller.dart`); там он
/// живёт в `app_client`, недоступен отсюда напрямую, поэтому здесь —
/// собственная константа с тем же значением. Тап по дню открывает
/// шторку «выходной / другие часы».
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/schedule_repository.dart';

/// Горизонт исключений — 14 дней вперёд, включая сегодня.
const int scheduleExceptionsHorizonDays = 14;

String _formatDate(DateTime day) {
  final y = day.year.toString().padLeft(4, '0');
  final m = day.month.toString().padLeft(2, '0');
  final d = day.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

const _weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

class ExceptionsScreen extends ConsumerStatefulWidget {
  const ExceptionsScreen({super.key});

  @override
  ConsumerState<ExceptionsScreen> createState() => _ExceptionsScreenState();
}

class _ExceptionsScreenState extends ConsumerState<ExceptionsScreen> {
  bool _loading = true;
  String? _error;
  late final List<DateTime> _days;
  Map<String, ScheduleException> _byDate = {};

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    _days = [
      for (var i = 0; i < scheduleExceptionsHorizonDays; i++)
        start.add(Duration(days: i)),
    ];
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref
          .read(scheduleRepositoryProvider)
          .exceptions(
            from: _formatDate(_days.first),
            to: _formatDate(_days.last),
          );
      if (!mounted) return;
      setState(() {
        _byDate = {for (final e in list) e.date: e};
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openSheet(DateTime day) async {
    final date = _formatDate(day);
    final existing = _byDate[date];

    final action = await showModalBottomSheet<_ExceptionAction>(
      context: context,
      builder: (context) => _ExceptionSheet(day: day, existing: existing),
    );
    if (action == null || !mounted) return;

    try {
      switch (action) {
        case _DayOffAction():
          final result = await ref
              .read(scheduleRepositoryProvider)
              .upsertException(date, isDayOff: true);
          setState(() => _byDate = {..._byDate, date: result});
        case _CustomHoursAction(:final startMin, :final endMin):
          final result = await ref
              .read(scheduleRepositoryProvider)
              .upsertException(
                date,
                isDayOff: false,
                startMin: startMin,
                endMin: endMin,
              );
          setState(() => _byDate = {..._byDate, date: result});
        case _ClearAction():
          await ref.read(scheduleRepositoryProvider).deleteException(date);
          setState(() {
            _byDate = {..._byDate}..remove(date);
          });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Исключения в расписании')),
      body: _loading
          ? const SqLoader()
          : _error != null
          ? Center(
              child: SqErrorView(text: _error!, onRetry: _load),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(SqSpacing.l),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: SqSpacing.s,
                crossAxisSpacing: SqSpacing.s,
                childAspectRatio: 1.2,
              ),
              itemCount: _days.length,
              itemBuilder: (context, index) {
                final day = _days[index];
                final exception = _byDate[_formatDate(day)];
                return _DayCell(
                  key: Key('exception-day-${_formatDate(day)}'),
                  day: day,
                  exception: exception,
                  onTap: () => _openSheet(day),
                );
              },
            ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    super.key,
    required this.day,
    required this.exception,
    required this.onTap,
  });

  final DateTime day;
  final ScheduleException? exception;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = switch (exception) {
      null => null,
      ScheduleException(isDayOff: true) => 'Выходной',
      ScheduleException(:final startMin, :final endMin) =>
        '${_pad(startMin! ~/ 60)}:${_pad(startMin % 60)}'
            '–${_pad(endMin! ~/ 60)}:${_pad(endMin % 60)}',
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(SqRadius.s),
      child: Container(
        decoration: BoxDecoration(
          color: exception == null ? SqColors.surface : SqColors.chipBg,
          border: Border.all(color: SqColors.border),
          borderRadius: BorderRadius.circular(SqRadius.s),
        ),
        padding: const EdgeInsets.all(SqSpacing.xs),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${_weekdayNames[day.weekday - 1]} ${day.day}',
              style: SqTypography.caption,
            ),
            if (label != null)
              Text(
                label,
                textAlign: TextAlign.center,
                style: SqTypography.caption.copyWith(
                  color: SqColors.primaryDark,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

String _pad(int v) => v.toString().padLeft(2, '0');

sealed class _ExceptionAction {}

class _DayOffAction extends _ExceptionAction {}

class _CustomHoursAction extends _ExceptionAction {
  _CustomHoursAction({required this.startMin, required this.endMin});

  final int startMin;
  final int endMin;
}

class _ClearAction extends _ExceptionAction {}

/// Шторка выбора действия для дня [day]: «выходной», «другие часы» или,
/// если уже есть исключение, «убрать исключение».
class _ExceptionSheet extends StatelessWidget {
  const _ExceptionSheet({required this.day, required this.existing});

  final DateTime day;
  final ScheduleException? existing;

  Future<void> _pickCustomHours(BuildContext context) async {
    final start = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 9, minute: 0),
    );
    if (start == null || !context.mounted) return;
    final end = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 18, minute: 0),
    );
    if (end == null || !context.mounted) return;

    Navigator.of(context).pop(
      _CustomHoursAction(
        startMin: start.hour * 60 + start.minute,
        endMin: end.hour * 60 + end.minute,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_formatDate(day), style: SqTypography.title),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              label: 'Сделать выходным',
              onPressed: () => Navigator.of(context).pop(_DayOffAction()),
            ),
            const SizedBox(height: SqSpacing.s),
            SqButton(
              label: 'Другие часы работы',
              kind: SqButtonKind.secondary,
              onPressed: () => _pickCustomHours(context),
            ),
            if (existing != null) ...[
              const SizedBox(height: SqSpacing.s),
              SqButton(
                label: 'Убрать исключение',
                kind: SqButtonKind.ghost,
                onPressed: () => Navigator.of(context).pop(_ClearAction()),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
