// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appTitle => 'SmartQoldau';

  @override
  String get actionContinue => 'Продолжить';

  @override
  String get actionCancel => 'Отмена';

  @override
  String get actionRetry => 'Повторить';

  @override
  String get actionClose => 'Закрыть';

  @override
  String get actionDone => 'Готово';

  @override
  String get actionBack => 'Назад';

  @override
  String get languageRussian => 'Русский';

  @override
  String get languageKazakh => 'Қазақша';

  @override
  String get errorGeneric => 'Что-то пошло не так';

  @override
  String get errorValidationFailed => 'Что-то пошло не так';

  @override
  String get errorUnauthorized => 'Сессия истекла, войдите заново';

  @override
  String get errorForbidden => 'Недостаточно прав для этого действия';

  @override
  String get errorNotFound => 'Запрашиваемые данные не найдены';

  @override
  String get errorConflict => 'Действие конфликтует с текущим состоянием';

  @override
  String get errorRateLimited => 'Слишком много попыток, подождите немного';

  @override
  String get errorInternal => 'Что-то пошло не так';

  @override
  String get errorSmsCodeInvalid => 'Неверный код';

  @override
  String get errorSmsCodeExpired => 'Код истёк, запросите новый';

  @override
  String get errorSmsRateLimited =>
      'Слишком много попыток, повторите чуть позже';

  @override
  String get errorPhoneAlreadyRegistered => 'Этот номер уже зарегистрирован';

  @override
  String get errorActiveRequestExists => 'У вас уже есть активная заявка';

  @override
  String get errorExpertUnavailable => 'Эксперт сейчас недоступен';

  @override
  String get errorExpertNotFound => 'Эксперт не найден';

  @override
  String get errorExpertBlocked => 'Эксперт недоступен для консультаций';

  @override
  String get errorRequestNotFound => 'Заявка не найдена';

  @override
  String get errorRequestAlreadyClosed => 'Заявка уже закрыта';

  @override
  String get errorConsultationNotFound => 'Консультация не найдена';

  @override
  String get errorConsultationNotActive => 'Консультация уже завершена';

  @override
  String get errorPaymentMethodNotFound => 'Способ оплаты не найден';

  @override
  String get errorPaymentNotFound => 'Платёж не найден';

  @override
  String get errorProviderDeclined => 'Платёж отклонён банком';

  @override
  String get errorAlreadyPaid => 'Уже оплачено';

  @override
  String get errorReviewExists => 'Вы уже оставили отзыв';

  @override
  String get errorReviewNotFound => 'Отзыв не найден';

  @override
  String get errorNotificationNotFound => 'Уведомление не найдено';

  @override
  String get errorDeviceNotFound => 'Устройство не найдено';

  @override
  String get errorTicketNotFound => 'Обращение не найдено';

  @override
  String get errorTicketContactRequired => 'Укажите контакт для связи';

  @override
  String get errorTicketCategoryNotAllowed =>
      'Эта категория недоступна для обращения';

  @override
  String get errorTicketAlreadyResolved => 'Обращение уже решено';

  @override
  String get errorNetwork => 'Нет соединения с сервером';

  @override
  String get splashTagline => 'Поддержка рядом, когда она нужна';

  @override
  String get phoneScreenTitle => 'Вход по номеру телефона';

  @override
  String get phoneScreenSubtitle => 'Это займёт меньше минуты';

  @override
  String get phoneNumberLabel => 'Номер телефона';

  @override
  String get phoneNumberHint => '+7 (7XX) XXX-XX-XX';

  @override
  String get phoneScreenHelper => 'Пришлём одноразовый код по SMS';

  @override
  String get actionGetCode => 'Получить код';

  @override
  String get codeScreenTitle => 'Введите код из SMS';

  @override
  String codeScreenSubtitle(String phone) {
    return 'Код отправлен на номер $phone';
  }

  @override
  String get actionResendCode => 'Отправить повторно';

  @override
  String resendCodeCountdown(int seconds) {
    return 'Отправить повторно через $seconds с';
  }
}
