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
  String get errorValidationFailed => 'Проверьте введённые данные';

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
  String get errorInternal => 'Ошибка на сервере, попробуйте позже';

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
  String get phoneNumberHint => 'XX) XXX-XX-XX';

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

  @override
  String get welcomeTitle => 'Добро пожаловать в SmartQoldau';

  @override
  String get welcomeSubtitle =>
      'Психологическая поддержка рядом — говорите об этом, когда будете готовы';

  @override
  String get actionLoginByPhone => 'Войти по номеру';

  @override
  String get actionContinueAnonymously => 'Продолжить анонимно';

  @override
  String get welcomeTermsLink => 'Пользовательское соглашение';

  @override
  String get welcomePrivacyLink => 'Политика конфиденциальности';

  @override
  String get slidesTitle1 => 'Разные форматы консультаций';

  @override
  String get slidesDescription1 =>
      'Общайтесь с психологом в чате, по аудио или видео — выбирайте удобный формат';

  @override
  String get slidesTitle2 => 'Конфиденциально и анонимно';

  @override
  String get slidesDescription2 =>
      'Можно обратиться без регистрации: имя указывать не обязательно, данные защищены';

  @override
  String get slidesTitle3 => 'Ответ за 1–2 минуты';

  @override
  String get slidesDescription3 =>
      'Психолог выходит на связь почти сразу — не нужно ждать часами';

  @override
  String get slidesSkip => 'Пропустить';

  @override
  String get slidesNext => 'Далее';

  @override
  String get slidesStart => 'Начать';

  @override
  String get permissionsTitle => 'Разрешения';

  @override
  String get permissionsSubtitle =>
      'Пригодится в звонках с психологом — эти разрешения можно настроить и позже';

  @override
  String get permissionMicrophoneTitle => 'Микрофон';

  @override
  String get permissionMicrophoneDescription =>
      'Нужен для аудиоконсультаций с психологом';

  @override
  String get permissionCameraTitle => 'Камера';

  @override
  String get permissionCameraDescription =>
      'Нужна для видеоконсультаций с психологом';

  @override
  String get permissionNotificationsTitle => 'Уведомления';

  @override
  String get permissionNotificationsDescription =>
      'Сообщим, когда психолог ответит или начнётся консультация';

  @override
  String get actionAllow => 'Разрешить';

  @override
  String get actionLater => 'Позже';

  @override
  String get navHome => 'Главная';

  @override
  String get navCatalog => 'Каталог';

  @override
  String get navConsultations => 'Консультации';

  @override
  String get navProfile => 'Профиль';

  @override
  String get stubSectionSubtitle => 'Раздел находится в разработке';

  @override
  String get homeGreeting => 'Здравствуйте';

  @override
  String get homeEmergencyCta => 'Мне нужна помощь сейчас';

  @override
  String get homeEmergencyCtaSubtitle =>
      'Среднее время подключения — до 2 минут';

  @override
  String get homeTopicsTitle => 'Мы поможем вам с:';

  @override
  String get homeTopicsSubtitle => 'или расскажите, что именно беспокоит';

  @override
  String get homeActiveConsultationTitle => 'Активная консультация';

  @override
  String get homeEmergencyNoticeTitle => 'Экстренная ситуация';

  @override
  String get homeEmergencyNoticeBody =>
      'У нас есть специалисты, готовые подключиться в приоритетном порядке прямо сейчас';

  @override
  String get emergencyDisclaimerText =>
      'Платформа не заменяет экстренные службы. Если жизни или здоровью угрожает опасность, звоните напрямую:';

  @override
  String get topicTitle => 'Расскажите, что вас тревожит';

  @override
  String get topicSubtitle =>
      'Проверьте тему и выберите формат общения — мы подберём подходящего специалиста';

  @override
  String get topicFormatLabel => 'Формат общения';

  @override
  String get topicFormatNotChosen => 'Выберите формат';

  @override
  String get formatChat => 'Чат';

  @override
  String get formatAudio => 'Аудио';

  @override
  String get formatVideo => 'Видео';

  @override
  String get formatSheetTitle => 'Как вам удобно общаться?';

  @override
  String get formatSheetCaption => '50 минут · цена зависит от специалиста';

  @override
  String get funnelActiveRequestTitle => 'У вас уже есть активная заявка';

  @override
  String get funnelActiveRequestBody =>
      'Дождитесь ответа по ней или отмените её, чтобы создать новую';

  @override
  String get searchTitle => 'Подбираем для вас подходящего психолога';

  @override
  String get searchSubtitle => 'Это займёт не более 2 минут';

  @override
  String get searchHint =>
      'Мы учитываем специализацию, язык и текущую доступность специалиста';

  @override
  String get searchElapsedLabel => 'Идёт поиск';

  @override
  String get searchEncouragement =>
      'Вы уже сделали важный шаг, обратившись за помощью';

  @override
  String get searchCancel => 'Отменить поиск';

  @override
  String get noExpertsTitle => 'Сейчас нет свободных специалистов';

  @override
  String get noExpertsBody =>
      'Попробуйте ещё раз через несколько минут или вернитесь на главную';

  @override
  String get actionTryAgain => 'Попробовать снова';

  @override
  String get actionGoHome => 'На главную';

  @override
  String searchOnlineCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count специалиста',
      many: '$count специалистов',
      few: '$count специалиста',
      one: '$count специалист',
    );
    return 'Сейчас онлайн: $_temp0';
  }
}
