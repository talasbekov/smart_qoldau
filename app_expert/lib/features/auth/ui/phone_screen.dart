/// Экран ввода номера телефона: маска `+7 (7XX) XXX-XX-XX`, кнопка активна
/// только при 11 введённых цифрах, наружу уходит `+77XXXXXXXXX`.
///
/// Единственная точка входа в приложение эксперта — гостевого режима нет
/// (см. `features/auth/state/auth_controller.dart`).
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/auth_controller.dart';
import 'code_screen.dart';

/// Количество свободных цифр, которые пользователь набирает после
/// фиксированного префикса `+7 (7` — тот же приём маски, что в
/// `app_client/lib/features/auth/ui/phone_screen.dart` (см. обоснование
/// там же — почему префикс не часть `TextEditingController.text`).
const _typedDigitsCount = 9;

String _stripRedundantPrefix(String digits) {
  final overflow = digits.length - _typedDigitsCount;
  if (overflow == 2 && (digits.startsWith('77') || digits.startsWith('87'))) {
    return digits.substring(2);
  }
  if (overflow == 1 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return digits.substring(1);
  }
  return digits;
}

class _PhoneMaskFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final raw = newValue.text.replaceAll(RegExp(r'\D'), '');
    final withoutPrefix = raw.length > _typedDigitsCount
        ? _stripRedundantPrefix(raw)
        : raw;
    final trimmed = withoutPrefix.length > _typedDigitsCount
        ? withoutPrefix.substring(0, _typedDigitsCount)
        : withoutPrefix;

    final buffer = StringBuffer();
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

  String get _digits => _controller.text.replaceAll(RegExp(r'\D'), '');

  bool get _canSubmit => _digits.length == _typedDigitsCount && !_submitting;

  String get _normalizedPhone => '+77$_digits';

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
        _errorText = e.message;
        _submitting = false;
      });
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => CodeScreen(phone: phone)));
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
              l10n.phoneScreenHint,
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
                prefixText: '+7 (7',
                prefixStyle: SqTypography.body.copyWith(
                  color: SqColors.textPrimary,
                ),
                hintText: '00) 000-00-00',
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
