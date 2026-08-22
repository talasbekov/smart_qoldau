// Тест на errorText: словарь ApiErrorCode из задачи 4 эпика E6 полностью
// покрыт локализованными текстами. Список кодов продублирован явно (а не
// собран рефлексией) — так же, как это уже сделано в
// `packages/shared/lib/api/api_exception.dart`, откуда он взят дословно.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/error_text.dart';
import 'package:app_client/l10n/app_localizations.dart';

/// Полный словарь кодов ошибок, известных клиенту (см.
/// `ApiErrorCode` в `packages/shared/lib/api/api_exception.dart`).
const _allCodes = <String>[
  ApiErrorCode.validationFailed,
  ApiErrorCode.unauthorized,
  ApiErrorCode.forbidden,
  ApiErrorCode.notFound,
  ApiErrorCode.conflict,
  ApiErrorCode.rateLimited,
  ApiErrorCode.internal,
  ApiErrorCode.smsCodeInvalid,
  ApiErrorCode.smsCodeExpired,
  ApiErrorCode.smsRateLimited,
  ApiErrorCode.phoneAlreadyRegistered,
  ApiErrorCode.activeRequestExists,
  ApiErrorCode.expertUnavailable,
  ApiErrorCode.expertNotFound,
  ApiErrorCode.expertBlocked,
  ApiErrorCode.requestNotFound,
  ApiErrorCode.requestAlreadyClosed,
  ApiErrorCode.consultationNotFound,
  ApiErrorCode.consultationNotActive,
  ApiErrorCode.paymentMethodNotFound,
  ApiErrorCode.paymentNotFound,
  ApiErrorCode.providerDeclined,
  ApiErrorCode.alreadyPaid,
  ApiErrorCode.reviewExists,
  ApiErrorCode.reviewNotFound,
  ApiErrorCode.notificationNotFound,
  ApiErrorCode.deviceNotFound,
  ApiErrorCode.ticketNotFound,
  ApiErrorCode.ticketContactRequired,
  ApiErrorCode.ticketCategoryNotAllowed,
  ApiErrorCode.ticketAlreadyResolved,
  ApiErrorCode.network,
];

void main() {
  testWidgets(
    'errorText покрывает каждый код словаря ApiErrorCode непустым текстом',
    (tester) async {
      late BuildContext capturedContext;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) {
              capturedContext = context;
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      final generic = AppLocalizations.of(capturedContext)!.errorGeneric;

      for (final code in _allCodes) {
        final text = errorText(
          capturedContext,
          ApiException(code, 'test message', 400),
        );
        expect(text, isNotEmpty, reason: 'код $code должен иметь текст');
        expect(
          text,
          isNot(generic),
          reason: 'код $code должен иметь текст, отличный от заглушки',
        );
      }
    },
  );

  testWidgets('неизвестный код даёт общий текст-заглушку', (tester) async {
    late BuildContext capturedContext;
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) {
            capturedContext = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    final generic = AppLocalizations.of(capturedContext)!.errorGeneric;
    final text = errorText(
      capturedContext,
      const ApiException('SOME_FUTURE_CODE', 'unseen', 500),
    );

    expect(text, generic);
  });
}
