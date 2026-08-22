/// Экран ввода номера телефона: маска `+7 (7XX) XXX-XX-XX`, кнопка
/// активна только при 11 введённых цифрах, наружу уходит `+77XXXXXXXXX`.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../state/auth_controller.dart';
import 'code_screen.dart';

/// Количество цифр, которое пользователь набирает после фиксированного
/// префикса `+7 (7` — код страны (`7`) и первая цифра мобильного номера
/// (тоже литеральная `7`, все казахстанские мобильные номера начинают
/// абонентский номер с неё) в маску уже вшиты.
const _typedDigitsCount = 9;

/// Полное число цифр в отформатированном тексте поля, когда маска
/// заполнена целиком: 2 фиксированных («7» кода страны + литеральная «7»
/// мобильного номера) плюс [_typedDigitsCount] набранных пользователем —
/// именно столько цифр реально лежит в `TextEditingController.text` после
/// [_PhoneMaskFormatter] (маска пишет фиксированные цифры прямо в текст, а
/// не только в декорацию), поэтому кнопка сверяется с этим числом, а не с
/// [_typedDigitsCount].
const _totalDigitsCount = 2 + _typedDigitsCount;

/// Преобразует набранные цифры в маску `+7 (7XX) XXX-XX-XX`.
class _PhoneMaskFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final trimmed = digits.length > _typedDigitsCount
        ? digits.substring(0, _typedDigitsCount)
        : digits;

    final buffer = StringBuffer('+7 (7');
    for (var i = 0; i < trimmed.length; i++) {
      if (i == 2) buffer.write(') ');
      if (i == 5) buffer.write('-');
      if (i == 7) buffer.write('-');
      buffer.write(trimmed[i]);
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Все цифры отформатированного текста поля — включая фиксированные
  /// «77» из маски, а не только набранные пользователем (см.
  /// [_totalDigitsCount]).
  String get _digits => _controller.text.replaceAll(RegExp(r'\D'), '');

  bool get _canSubmit => _digits.length == _totalDigitsCount && !_submitting;

  /// `+77XXXXXXXXX` — просто [_digits] с ведущим `+`, потому что
  /// фиксированные «77» уже часть [_digits] (их пишет маска).
  String get _normalizedPhone => '+$_digits';

  Future<void> _submit() async {
    if (!_canSubmit) return;
    final phone = _normalizedPhone;
    setState(() {
      _submitting = true;
      _errorText = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).requestCode(phone);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = errorText(context, e);
        _submitting = false;
      });
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => CodeScreen(phone: phone)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.phoneScreenTitle)),
      body: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.phoneScreenSubtitle,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            ),
            const SizedBox(height: SqSpacing.xl),
            TextField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              inputFormatters: [_PhoneMaskFormatter()],
              style: SqTypography.body.copyWith(color: SqColors.textPrimary),
              decoration: InputDecoration(
                labelText: l10n.phoneNumberLabel,
                hintText: l10n.phoneNumberHint,
                errorText: _errorText,
                filled: true,
                fillColor: SqColors.surface,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: SqSpacing.m,
                  vertical: SqSpacing.m,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SqRadius.m),
                  borderSide: const BorderSide(color: SqColors.border),
                ),
              ),
            ),
            const SizedBox(height: SqSpacing.s),
            Text(l10n.phoneScreenHelper, style: SqTypography.caption),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              label: l10n.actionGetCode,
              loading: _submitting,
              onPressed: _canSubmit ? () => _submit() : null,
            ),
          ],
        ),
      ),
    );
  }
}
