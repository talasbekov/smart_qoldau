/// Экран добавления карты: маска номера, проверка Луна и валидация срока.
///
/// PAN не логируется нигде: ни `debugPrint`, ни аналитика, ни сообщения об
/// ошибке его не содержат — в лог уходит только факт неудачи.
library;

import 'dart:developer' as developer;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../data/payments_repository.dart';
import '../state/cards_controller.dart';

/// Проверка Луна. Бэкенд её не делает (см. `AddPaymentMethodDto`: только
/// длина 12–19 и «только цифры»), поэтому заведомо мусорный номер
/// отбраковывается здесь — иначе он уедет в провайдера и вернётся
/// невнятным отказом.
bool isValidPan(String digits) {
  if (digits.length < 12 || digits.length > 19) return false;
  var sum = 0;
  var double = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var value = int.parse(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 == 0;
}

/// `MM/YY` с реально существующим месяцем.
bool isValidExpiry(String value) =>
    RegExp(r'^(0[1-9]|1[0-2])/\d{2}$').hasMatch(value);

/// Группирует цифры по четыре: `4242 4242 4242 4242`.
class _PanFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final limited = digits.length > 19 ? digits.substring(0, 19) : digits;
    final buffer = StringBuffer();
    for (var i = 0; i < limited.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(limited[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// Ставит `/` после месяца: `12/29`.
class _ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final limited = digits.length > 4 ? digits.substring(0, 4) : digits;
    final text = limited.length <= 2
        ? limited
        : '${limited.substring(0, 2)}/${limited.substring(2)}';
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

class AddCardScreen extends ConsumerStatefulWidget {
  const AddCardScreen({super.key});

  @override
  ConsumerState<AddCardScreen> createState() => _AddCardScreenState();
}

class _AddCardScreenState extends ConsumerState<AddCardScreen> {
  final _pan = TextEditingController();
  final _expiry = TextEditingController();
  final _holder = TextEditingController();
  final _panFocus = FocusNode();
  final _expiryFocus = FocusNode();
  final _holderFocus = FocusNode();

  bool _saving = false;
  String? _panError;
  String? _expiryError;
  String? _holderError;
  String? _apiError;

  @override
  void dispose() {
    _pan.dispose();
    _expiry.dispose();
    _holder.dispose();
    _panFocus.dispose();
    _expiryFocus.dispose();
    _holderFocus.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    final digits = _pan.text.replaceAll(RegExp(r'\D'), '');
    final holder = _holder.text.trim();

    setState(() {
      _apiError = null;
      _panError = isValidPan(digits) ? null : l10n.cardNumberInvalid;
      _expiryError = isValidExpiry(_expiry.text) ? null : l10n.cardExpiryInvalid;
      _holderError = holder.length >= 2 && holder.length <= 100
          ? null
          : l10n.cardHolderInvalid;
    });
    if (_panError != null || _expiryError != null || _holderError != null) {
      return;
    }

    setState(() => _saving = true);
    try {
      await ref
          .read(paymentsRepositoryProvider)
          .addCard(
            pan: digits,
            expiry: _expiry.text,
            holderName: holder,
          );
      // Список карт мог быть уже загружен шторкой оплаты — он устарел.
      ref.invalidate(cardsControllerProvider);
      if (!mounted) return;
      context.go(RoutePaths.cards);
    } on ApiException catch (error) {
      // В лог — только код: ни PAN, ни имя держателя в диагностику не
      // попадают.
      developer.log(
        'привязка карты не удалась: ${error.code}',
        name: 'AddCardScreen',
      );
      if (mounted) setState(() => _apiError = errorText(context, error));
    } catch (error) {
      developer.log(
        'привязка карты не удалась: ${error.runtimeType}',
        name: 'AddCardScreen',
      );
      if (mounted) {
        setState(() => _apiError = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      // Урок 4 плана эпика: флаг занятости снимается и в аварийной ветке.
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.addCardTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            SqTextField(
              key: const Key('sq-card-number'),
              controller: _pan,
              focusNode: _panFocus,
              label: l10n.cardNumberLabel,
              hint: '0000 0000 0000 0000',
              keyboardType: TextInputType.number,
              inputFormatters: [_PanFormatter()],
              errorText: _panError,
              // Авто-перехода фокуса с номера сознательно НЕТ, хотя бриф
              // задачи его просил: длина PAN у бэкенда 12–19
              // (`AddPaymentMethodDto`), и прыжок на 16-й цифре увёл бы
              // хвост 17–19 в поле срока действия. Авто-переход остаётся
              // там, где длина фиксирована, — на сроке действия.
            ),
            const SizedBox(height: SqSpacing.m),
            SqTextField(
              key: const Key('sq-card-expiry'),
              controller: _expiry,
              focusNode: _expiryFocus,
              label: l10n.cardExpiryLabel,
              hint: 'MM/YY',
              keyboardType: TextInputType.number,
              inputFormatters: [_ExpiryFormatter()],
              errorText: _expiryError,
              onChanged: (value) {
                if (value.length == 5) _holderFocus.requestFocus();
              },
            ),
            const SizedBox(height: SqSpacing.m),
            SqTextField(
              key: const Key('sq-card-holder'),
              controller: _holder,
              focusNode: _holderFocus,
              label: l10n.cardHolderLabel,
              hint: 'IVAN IVANOV',
              errorText: _holderError,
            ),
            if (_apiError != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _apiError!,
                key: const Key('sq-card-api-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-card-save'),
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
