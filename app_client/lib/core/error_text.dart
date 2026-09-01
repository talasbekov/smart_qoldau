/// Локализованные тексты ошибок API по коду ([ApiErrorCode]).
library;

import 'package:flutter/widgets.dart';
import 'package:shared/shared.dart';

import '../l10n/app_localizations.dart';

/// Возвращает локализованный текст ошибки [exception] по её [ApiException
/// .code]. Покрывает весь словарь [ApiErrorCode] — неизвестный код (в
/// принципе не должен встречаться, словарь синхронизирован с бэкендом)
/// получает общую заглушку [AppLocalizations.errorGeneric].
///
/// `INTERNAL` и `VALIDATION_FAILED` — коды, которые пользователь не должен
/// увидеть осмысленно (это ошибки клиента/сервера, а не бизнес-события) —
/// сознательно используют тот же текст, что и заглушка, но через свои
/// собственные ключи ARB: если завтра понадобится их уточнить, ключ уже
/// на месте.
String errorText(BuildContext context, ApiException exception) {
  final l10n = AppLocalizations.of(context)!;
  switch (exception.code) {
    case ApiErrorCode.validationFailed:
      return l10n.errorValidationFailed;
    case ApiErrorCode.unauthorized:
      return l10n.errorUnauthorized;
    case ApiErrorCode.forbidden:
      return l10n.errorForbidden;
    case ApiErrorCode.notFound:
      return l10n.errorNotFound;
    case ApiErrorCode.conflict:
      return l10n.errorConflict;
    case ApiErrorCode.rateLimited:
      return l10n.errorRateLimited;
    case ApiErrorCode.internal:
      return l10n.errorInternal;
    case ApiErrorCode.smsCodeInvalid:
      return l10n.errorSmsCodeInvalid;
    case ApiErrorCode.smsCodeExpired:
      return l10n.errorSmsCodeExpired;
    case ApiErrorCode.smsRateLimited:
      return l10n.errorSmsRateLimited;
    case ApiErrorCode.phoneAlreadyRegistered:
      return l10n.errorPhoneAlreadyRegistered;
    case ApiErrorCode.activeRequestExists:
      return l10n.errorActiveRequestExists;
    case ApiErrorCode.expertUnavailable:
      return l10n.errorExpertUnavailable;
    case ApiErrorCode.expertNotFound:
      return l10n.errorExpertNotFound;
    case ApiErrorCode.expertBlocked:
      return l10n.errorExpertBlocked;
    case ApiErrorCode.requestNotFound:
      return l10n.errorRequestNotFound;
    case ApiErrorCode.requestAlreadyClosed:
      return l10n.errorRequestAlreadyClosed;
    case ApiErrorCode.consultationNotFound:
      return l10n.errorConsultationNotFound;
    case ApiErrorCode.consultationNotActive:
      return l10n.errorConsultationNotActive;
    case ApiErrorCode.paymentMethodNotFound:
      return l10n.errorPaymentMethodNotFound;
    case ApiErrorCode.paymentNotFound:
      return l10n.errorPaymentNotFound;
    case ApiErrorCode.providerDeclined:
    // PAYMENT_DECLINED подписки — тот же случай для человека, что отказ
    // банка по консультации: карта не сработала.
    case ApiErrorCode.paymentDeclined:
      return l10n.errorProviderDeclined;
    case ApiErrorCode.subscriptionExists:
      return l10n.errorSubscriptionExists;
    case ApiErrorCode.subscriptionNotFound:
      return l10n.errorSubscriptionNotFound;
    case ApiErrorCode.alreadyPaid:
      return l10n.errorAlreadyPaid;
    case ApiErrorCode.reviewExists:
      return l10n.errorReviewExists;
    case ApiErrorCode.reviewNotFound:
      return l10n.errorReviewNotFound;
    case ApiErrorCode.notificationNotFound:
      return l10n.errorNotificationNotFound;
    case ApiErrorCode.deviceNotFound:
      return l10n.errorDeviceNotFound;
    case ApiErrorCode.ticketNotFound:
      return l10n.errorTicketNotFound;
    case ApiErrorCode.ticketContactRequired:
      return l10n.errorTicketContactRequired;
    case ApiErrorCode.ticketCategoryNotAllowed:
      return l10n.errorTicketCategoryNotAllowed;
    case ApiErrorCode.ticketAlreadyResolved:
      return l10n.errorTicketAlreadyResolved;
    case ApiErrorCode.network:
      return l10n.errorNetwork;
    default:
      return l10n.errorGeneric;
  }
}
