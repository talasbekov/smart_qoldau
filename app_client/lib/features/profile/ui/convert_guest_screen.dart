/// Конверсия гостевой сессии в полноценный аккаунт (Р-22).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/state/auth_controller.dart';

class ConvertGuestScreen extends ConsumerStatefulWidget {
  const ConvertGuestScreen({super.key});

  @override
  ConsumerState<ConvertGuestScreen> createState() => _ConvertGuestScreenState();
}

class _ConvertGuestScreenState extends ConsumerState<ConvertGuestScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();

  bool _codeRequested = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  String get _e164 => '+7${_phone.text.replaceAll(RegExp(r'\D'), '')}';

  Future<void> _requestCode() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).requestCode(_e164);
      if (mounted) setState(() => _codeRequested = true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .convertGuest(_e164, _code.text.trim());
      if (mounted) context.go(RoutePaths.profile);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error.code == ApiErrorCode.phoneAlreadyRegistered
            // Общий текст «номер уже зарегистрирован» здесь недостаточен:
            // человек должен понимать, что войти в тот аккаунт можно, но
            // данные гостевой сессии в него НЕ переедут.
            ? AppLocalizations.of(context)!.convertGuestPhoneAlreadyUsed
            : errorText(context, error),
      );
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      // Урок 4 плана эпика: флаг занятости снимается и в аварийной ветке.
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.convertGuestTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            Text(
              l10n.profileGuestBody,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            ),
            const SizedBox(height: SqSpacing.l),
            SqTextField(
              key: const Key('sq-convert-phone'),
              controller: _phone,
              label: l10n.phoneNumberLabel,
              hint: l10n.phoneNumberHint,
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: SqSpacing.m),
            if (!_codeRequested)
              SqButton(
                key: const Key('sq-convert-request-code'),
                label: l10n.actionGetCode,
                loading: _busy,
                onPressed: _busy ? null : _requestCode,
              )
            else ...[
              SqTextField(
                key: const Key('sq-convert-code'),
                controller: _code,
                label: l10n.codeScreenTitle,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: SqSpacing.m),
              SqButton(
                key: const Key('sq-convert-submit'),
                label: l10n.profileCreateAccount,
                loading: _busy,
                onPressed: _busy ? null : _submit,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _error!,
                key: const Key('sq-convert-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
