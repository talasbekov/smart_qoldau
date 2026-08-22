/// Экран ввода SMS-кода: 4 ячейки, автоподтверждение по 4-й цифре,
/// обратный отсчёт повторной отправки 45 секунд (Р-10/ТЗ §5.1).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../state/auth_controller.dart';

/// Длительность обратного отсчёта до разблокировки повторной отправки
/// SMS-кода (Р-10/ТЗ §5.1).
const codeResendCooldown = Duration(seconds: 45);

const _cellCount = 4;

class CodeScreen extends ConsumerStatefulWidget {
  const CodeScreen({super.key, required this.phone});

  /// Телефон в формате `+77XXXXXXXXX`, на который отправлен код.
  final String phone;

  @override
  ConsumerState<CodeScreen> createState() => _CodeScreenState();
}

class _CodeScreenState extends ConsumerState<CodeScreen> {
  final _controllers = List.generate(
    _cellCount,
    (_) => TextEditingController(),
  );
  final _focusNodes = List.generate(_cellCount, (_) => FocusNode());

  Timer? _timer;
  int _secondsLeft = codeResendCooldown.inSeconds;
  bool _verifying = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() => _secondsLeft = codeResendCooldown.inSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 1) {
        timer.cancel();
        setState(() => _secondsLeft = 0);
      } else {
        setState(() => _secondsLeft -= 1);
      }
    });
  }

  void _onDigitChanged(int index, String value) {
    if (value.isNotEmpty && index < _cellCount - 1) {
      _focusNodes[index + 1].requestFocus();
    }
    final code = _controllers.map((c) => c.text).join();
    if (code.length == _cellCount && !_verifying) {
      _verify(code);
    }
  }

  Future<void> _verify(String code) async {
    setState(() {
      _verifying = true;
      _errorText = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyCode(widget.phone, code);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = errorText(context, e);
        _verifying = false;
      });
      for (final controller in _controllers) {
        controller.clear();
      }
      _focusNodes.first.requestFocus();
      return;
    }
    if (!mounted) return;
    setState(() => _verifying = false);
  }

  Future<void> _resend() async {
    if (_secondsLeft > 0) return;
    try {
      await ref.read(authControllerProvider.notifier).requestCode(widget.phone);
    } on ApiException catch (e) {
      if (!mounted) return;
      // Сознательно НЕ перезапускаем отсчёт здесь, в том числе при
      // SMS_RATE_LIMITED: бэкенд не сообщает, сколько реально осталось
      // ждать (проверено — ответ приходит без деталей с оставшимися
      // секундами), а показать выдуманные "45 с", когда на сервере могло
      // остаться и 5, вводит в заблуждение больше, чем оставить кнопку как
      // есть (она уже разблокирована — пользователь может просто
      // попробовать ещё раз). Успешный путь ниже отсчёт перезапускает —
      // там 45 секунд достоверны, это уже наш собственный локальный
      // кулдаун, а не отражение серверного состояния.
      setState(() => _errorText = errorText(context, e));
      return;
    }
    if (!mounted) return;
    _startCountdown();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.codeScreenTitle)),
      body: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.codeScreenSubtitle(widget.phone),
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            ),
            const SizedBox(height: SqSpacing.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(_cellCount, _buildCell),
            ),
            if (_errorText != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _errorText!,
                textAlign: TextAlign.center,
                style: SqTypography.caption.copyWith(color: SqColors.danger),
              ),
            ],
            const SizedBox(height: SqSpacing.xl),
            Center(
              child: TextButton(
                onPressed: _secondsLeft == 0 ? _resend : null,
                child: Text(
                  _secondsLeft == 0
                      ? l10n.actionResendCode
                      : l10n.resendCodeCountdown(_secondsLeft),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCell(int index) {
    return SizedBox(
      width: 56,
      height: 64,
      child: TextField(
        controller: _controllers[index],
        focusNode: _focusNodes[index],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(1),
        ],
        style: SqTypography.h2,
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: SqColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(SqRadius.m),
            borderSide: const BorderSide(color: SqColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(SqRadius.m),
            borderSide: const BorderSide(color: SqColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(SqRadius.m),
            borderSide: const BorderSide(color: SqColors.primary, width: 2),
          ),
        ),
        onChanged: (value) => _onDigitChanged(index, value),
      ),
    );
  }
}
