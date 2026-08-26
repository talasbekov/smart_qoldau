/// Экран приветствия (БП-10 шаг 1–2) — точка входа для неавторизованного
/// пользователя.
///
/// Кнопки входа по номеру и анонимного продолжения визуально равноправны:
/// анонимный вход — центральная фича платформы против стигмы (БП-10), а не
/// мелкая ссылка внизу экрана.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/legal_links.dart';
import '../../../core/url_launcher_port.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/state/auth_controller.dart';
import '../../auth/ui/phone_screen.dart';

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  bool _continuingAnonymously = false;

  void _loginByPhone() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const PhoneScreen()));
  }

  Future<void> _continueAnonymously() async {
    // Guard внутри самого обработчика, а не только через `onPressed: null`
    // у кнопки: `onPressed`, захваченный в уже построенном дереве, не
    // обновится до следующего перестроения (`pump`), поэтому быстрый
    // повторный тап ДО первого кадра после `setState` мог бы вызвать этот
    // метод второй раз, даже пока кнопка визуально уже заблокирована — тот
    // же приём, что `_finishing` в `SlidesScreen`/`_requesting` в
    // `PermissionsScreen`.
    if (_continuingAnonymously) return;
    setState(() => _continuingAnonymously = true);
    try {
      await ref.read(authControllerProvider.notifier).continueAsGuest();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(errorText(context, e))));
    } finally {
      if (mounted) setState(() => _continuingAnonymously = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.l),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Text(
                l10n.welcomeTitle,
                style: SqTypography.h1,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.s),
              Text(
                l10n.welcomeSubtitle,
                style: SqTypography.body.copyWith(
                  color: SqColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              SqButton(
                key: const Key('sq-welcome-phone-button'),
                label: l10n.actionLoginByPhone,
                onPressed: _continuingAnonymously ? null : _loginByPhone,
              ),
              const SizedBox(height: SqSpacing.m),
              SqButton(
                key: const Key('sq-welcome-guest-button'),
                kind: SqButtonKind.secondary,
                label: l10n.actionContinueAnonymously,
                loading: _continuingAnonymously,
                onPressed: _continuingAnonymously ? null : _continueAnonymously,
              ),
              const SizedBox(height: SqSpacing.l),
              // Wrap, а не Row: две ссылки с разделителем не помещаются в
              // одну строку на телефоне шириной 411 dp — на эмуляторе
              // Android это давало RenderFlex overflow на 78 пикселей.
              // Виджет-тесты этого не видели: тестовый экран шире
              // реального телефона.
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                // Разделителя между ссылками нет намеренно: при переносе
                // на вторую строку он повисал в конце первой. Ссылки
                // разделяет отступ кнопок.
                children: [
                  TextButton(
                    onPressed: () =>
                        ref.read(urlLauncherPortProvider).launch(termsUrl),
                    child: Text(
                      l10n.welcomeTermsLink,
                      style: SqTypography.caption,
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        ref.read(urlLauncherPortProvider).launch(privacyUrl),
                    child: Text(
                      l10n.welcomePrivacyLink,
                      style: SqTypography.caption,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
