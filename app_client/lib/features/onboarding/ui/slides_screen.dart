/// Три вводных слайда онбординга (БП-10 шаг 3): форматы консультаций,
/// конфиденциальность и анонимность, скорость ответа.
///
/// Экран сам никуда не навигирует — как `SplashScreen` (задача 5), он
/// зовёт [onFinished] и оставляет решение о том, куда вести пользователя
/// дальше, вызывающей стороне: маршрутизации пока нет (`go_router` ставит
/// задача 7), а изобретать её здесь означало бы лишнюю абстракцию, которую
/// задаче 7 придётся снова разбирать.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/onboarding_flags.dart';

class _SlideData {
  const _SlideData({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}

class SlidesScreen extends ConsumerStatefulWidget {
  const SlidesScreen({super.key, required this.onFinished});

  /// Вызывается один раз — когда пользователь пропустил слайды или дошёл
  /// до конца («Начать» на последнем).
  final VoidCallback onFinished;

  @override
  ConsumerState<SlidesScreen> createState() => _SlidesScreenState();
}

class _SlidesScreenState extends ConsumerState<SlidesScreen> {
  final _controller = PageController();
  int _currentPage = 0;

  /// Блокирует «Пропустить»/«Далее»/«Начать» на время перехода — что
  /// финального (запись флага в `SharedPreferences`), что промежуточного
  /// (анимация `PageController.nextPage`) — тот же guard, что `_requesting`
  /// на `PermissionsScreen`: без него быстрый двойной тап по одной и той же
  /// кнопке мог бы дважды дёрнуть переход.
  bool _finishing = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Общий guard-обёртка вокруг [_finish] — вызывается и «Пропустить»
  /// (с любого слайда), и «Начать» (только с последнего).
  ///
  /// `await` внутри — в `try/catch/finally`, по образцу
  /// `_continueAnonymously` на `WelcomeScreen`: если `setSeenSlides` (или
  /// сам [_finish]) бросит исключение (например, инвалидация
  /// `SharedPreferences`), `_finishing` обязан сброситься всё равно —
  /// иначе экран навсегда останется с заблокированными
  /// «Пропустить»/«Далее»/«Начать» без единого способа восстановиться.
  /// Само исключение гасится молча (как несостоявшаяся запись
  /// `sq.locale` в `LocaleController.setLocale`) — записи флага прогресса
  /// не критичны для пользователя настолько, чтобы экран падал или
  /// показывал ошибку из-за них; хуже, если это заблокирует кнопки.
  Future<void> _guardedFinish() async {
    if (_finishing) return;
    setState(() => _finishing = true);
    try {
      await _finish();
    } catch (_) {
      // Намеренно молча — см. комментарий выше.
    } finally {
      if (mounted) setState(() => _finishing = false);
    }
  }

  Future<void> _finish() async {
    await ref.read(onboardingFlagsProvider).setSeenSlides(true);
    // Мониторинг за `mounted` — как в `PermissionsScreen._finish()`: экран
    // сам никуда не навигирует, но задача 7 повесит на `onFinished`
    // настоящую навигацию, и звать колбэк после `await` на уже
    // размонтированном виджете (например, если пользователь успел уйти с
    // экрана другим путём, пока ждали запись в `SharedPreferences`) —
    // ошибка, которую стоит исключить сейчас, а не когда она станет видна
    // только через реальный роутер.
    if (!mounted) return;
    widget.onFinished();
  }

  Future<void> _next(int slideCount) async {
    if (_finishing) return;
    if (_currentPage == slideCount - 1) {
      await _guardedFinish();
      return;
    }
    setState(() => _finishing = true);
    try {
      await _controller.nextPage(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    } catch (_) {
      // Намеренно молча — см. комментарий у [_guardedFinish].
    } finally {
      if (mounted) setState(() => _finishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final slides = [
      _SlideData(
        icon: Icons.forum_outlined,
        title: l10n.slidesTitle1,
        description: l10n.slidesDescription1,
      ),
      _SlideData(
        icon: Icons.lock_outline,
        title: l10n.slidesTitle2,
        description: l10n.slidesDescription2,
      ),
      _SlideData(
        icon: Icons.bolt_outlined,
        title: l10n.slidesTitle3,
        description: l10n.slidesDescription3,
      ),
    ];

    return Scaffold(
      backgroundColor: SqColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(SqSpacing.s),
                child: TextButton(
                  onPressed: _finishing ? null : _guardedFinish,
                  child: Text(l10n.slidesSkip),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: slides.length,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemBuilder: (context, index) =>
                    _SlideView(data: slides[index]),
              ),
            ),
            _Indicator(count: slides.length, currentIndex: _currentPage),
            Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqButton(
                label: _currentPage == slides.length - 1
                    ? l10n.slidesStart
                    : l10n.slidesNext,
                loading: _finishing && _currentPage == slides.length - 1,
                onPressed: _finishing ? null : () => _next(slides.length),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.data});

  final _SlideData data;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(SqSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(data.icon, size: 96, color: SqColors.primary),
          const SizedBox(height: SqSpacing.xl),
          Text(data.title, style: SqTypography.h2, textAlign: TextAlign.center),
          const SizedBox(height: SqSpacing.s),
          Text(
            data.description,
            style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Индикатор страниц: точка текущей страницы шире и окрашена в
/// [SqColors.primary], остальные — в [SqColors.border]. Ключи `sq-onboarding
/// -dot-N` позволяют тестам проверять состояние индикатора напрямую по
/// цвету, не завязываясь на анимацию.
class _Indicator extends StatelessWidget {
  const _Indicator({required this.count, required this.currentIndex});

  final int count;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final active = index == currentIndex;
        return AnimatedContainer(
          key: ValueKey('sq-onboarding-dot-$index'),
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: SqSpacing.xs / 2),
          width: active ? 20 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: active ? SqColors.primary : SqColors.border,
            borderRadius: BorderRadius.circular(SqRadius.pill),
          ),
        );
      }),
    );
  }
}
