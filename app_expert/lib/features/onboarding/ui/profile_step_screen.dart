/// Шаг 1/2 анкеты онбординга: профильные поля специалиста (без фото и
/// документов верификации — те отдельными задачами эпика E7, задачи 5/6).
///
/// Города, опыт и языки — фиксированные словари ТЗ (`БП-04 Онбординг и
/// верификация эксперта`): три города (Астана/Алматы/Шымкент), 5 градаций
/// опыта, 3 языка (рус/каз/англ).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/onboarding_controller.dart';

const _cities = ['Астана', 'Алматы', 'Шымкент'];
const _languageCodes = ['ru', 'kk', 'en'];

String _languageLabel(AppLocalizations l10n, String code) => switch (code) {
  'ru' => l10n.languageRussian,
  'kk' => l10n.languageKazakh,
  'en' => l10n.languageEnglish,
  _ => code,
};

String _experienceLabel(AppLocalizations l10n, ExperienceLevel level) =>
    switch (level) {
      ExperienceLevel.lessThanYear => l10n.experienceLessThanYear,
      ExperienceLevel.oneToThree => l10n.experienceOneToThree,
      ExperienceLevel.threeToFive => l10n.experienceThreeToFive,
      ExperienceLevel.fiveToTen => l10n.experienceFiveToTen,
      ExperienceLevel.moreThanTen => l10n.experienceMoreThanTen,
    };

String _formatLabel(AppLocalizations l10n, SessionFormat format) =>
    switch (format) {
      SessionFormat.chat => l10n.formatChat,
      SessionFormat.audio => l10n.formatAudio,
      SessionFormat.video => l10n.formatVideo,
    };

class ProfileStepScreen extends StatefulWidget {
  const ProfileStepScreen({super.key});

  @override
  State<ProfileStepScreen> createState() => _ProfileStepScreenState();
}

class _ProfileStepScreenState extends State<ProfileStepScreen> {
  final _displayNameController = TextEditingController();
  final _educationController = TextEditingController();
  final _priceController = TextEditingController();

  String _city = _cities.first;
  ExperienceLevel _experience = ExperienceLevel.lessThanYear;
  final Set<String> _languages = {};
  final Set<SessionFormat> _formats = {};

  @override
  void initState() {
    super.initState();
    _displayNameController.addListener(() => setState(() {}));
    _educationController.addListener(() => setState(() {}));
    _priceController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _educationController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  /// Клиентская валидация — только непустота обязательных полей.
  /// Ценовой коридор (200 000–1 500 000 тиын) проверяет бэкенд
  /// (`PRICE_OUT_OF_RANGE` показывается текстом на шаге 2 после отправки) —
  /// см. бриф задачи 4, дублировать бизнес-правило на клиенте не нужно.
  bool get _canProceed =>
      _displayNameController.text.trim().isNotEmpty &&
      _educationController.text.trim().isNotEmpty;

  void _toggleLanguage(String code) {
    setState(() {
      if (!_languages.add(code)) _languages.remove(code);
    });
  }

  void _toggleFormat(SessionFormat format) {
    setState(() {
      if (!_formats.add(format)) _formats.remove(format);
    });
  }

  void _next() {
    if (!_canProceed) return;
    final priceTenge = int.tryParse(_priceController.text.trim()) ?? 0;
    final draft = ProfileDraft(
      displayName: _displayNameController.text.trim(),
      city: _city,
      experience: _experience,
      education: _educationController.text.trim(),
      priceTiyn: priceTenge * 100,
      languages: _languages.toList(),
      formats: _formats.toList(),
    );
    context.push(RoutePaths.onboardingTopics, extra: draft);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.onboardingProfileTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            SqTextField(
              key: const Key('sq-onboarding-display-name'),
              label: l10n.fieldFullName,
              controller: _displayNameController,
            ),
            const SizedBox(height: SqSpacing.l),
            Text(l10n.fieldCity, style: SqTypography.title),
            const SizedBox(height: SqSpacing.s),
            Wrap(
              spacing: SqSpacing.s,
              children: [
                for (final city in _cities)
                  GestureDetector(
                    key: Key('sq-onboarding-city-$city'),
                    onTap: () => setState(() => _city = city),
                    child: SqChip(label: city, selected: _city == city),
                  ),
              ],
            ),
            const SizedBox(height: SqSpacing.l),
            Text(l10n.fieldExperience, style: SqTypography.title),
            const SizedBox(height: SqSpacing.s),
            Wrap(
              spacing: SqSpacing.s,
              runSpacing: SqSpacing.s,
              children: [
                for (final level in ExperienceLevel.values)
                  GestureDetector(
                    key: Key('sq-onboarding-experience-${level.wireValue}'),
                    onTap: () => setState(() => _experience = level),
                    child: SqChip(
                      label: _experienceLabel(l10n, level),
                      selected: _experience == level,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: SqSpacing.l),
            SqTextField(
              key: const Key('sq-onboarding-education'),
              label: l10n.fieldEducation,
              controller: _educationController,
            ),
            const SizedBox(height: SqSpacing.l),
            SqTextField(
              key: const Key('sq-onboarding-price'),
              label: l10n.fieldPriceTenge,
              controller: _priceController,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: SqSpacing.l),
            Text(l10n.fieldLanguages, style: SqTypography.title),
            const SizedBox(height: SqSpacing.s),
            Wrap(
              spacing: SqSpacing.s,
              children: [
                for (final code in _languageCodes)
                  GestureDetector(
                    key: Key('sq-onboarding-lang-$code'),
                    onTap: () => _toggleLanguage(code),
                    child: SqChip(
                      label: _languageLabel(l10n, code),
                      selected: _languages.contains(code),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: SqSpacing.l),
            Text(l10n.fieldFormats, style: SqTypography.title),
            const SizedBox(height: SqSpacing.s),
            Wrap(
              spacing: SqSpacing.s,
              children: [
                for (final format in SessionFormat.values)
                  GestureDetector(
                    key: Key('sq-onboarding-format-${format.wireValue}'),
                    onTap: () => _toggleFormat(format),
                    child: SqChip(
                      label: _formatLabel(l10n, format),
                      selected: _formats.contains(format),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-onboarding-next'),
              label: l10n.actionNext,
              onPressed: _canProceed ? _next : null,
            ),
          ],
        ),
      ),
    );
  }
}
