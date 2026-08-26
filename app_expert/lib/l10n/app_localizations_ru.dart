// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appTitle => 'SmartQoldau Эксперт';

  @override
  String get splashLoading => 'Загружаем ваш кабинет…';

  @override
  String get phoneScreenTitle => 'Вход для специалиста';

  @override
  String get phoneScreenHint =>
      'Введите номер телефона — на него придёт код подтверждения';

  @override
  String get phoneNumberLabel => 'Номер телефона';

  @override
  String get actionGetCode => 'Получить код';

  @override
  String get codeScreenTitle => 'Код подтверждения';

  @override
  String codeScreenSentTo(String phone) {
    return 'Мы отправили код на $phone';
  }

  @override
  String get actionResendCode => 'Отправить код повторно';

  @override
  String resendCodeCountdown(int seconds) {
    return 'Повторно через $seconds с';
  }

  @override
  String get actionRetry => 'Повторить';

  @override
  String get actionNext => 'Далее';

  @override
  String get actionSubmitProfile => 'Отправить анкету';

  @override
  String get errorLoadFailed => 'Не удалось загрузить данные';

  @override
  String get onboardingProfileTitle => 'Анкета специалиста — шаг 1 из 2';

  @override
  String get fieldFullName => 'Имя и фамилия';

  @override
  String get fieldCity => 'Город';

  @override
  String get fieldExperience => 'Опыт работы';

  @override
  String get fieldEducation => 'Образование';

  @override
  String get fieldPriceTenge => 'Стоимость консультации, ₸';

  @override
  String get fieldLanguages => 'Языки консультации';

  @override
  String get fieldFormats => 'Форматы консультаций';

  @override
  String get languageRussian => 'Русский';

  @override
  String get languageKazakh => 'Казахский';

  @override
  String get languageEnglish => 'Английский';

  @override
  String get experienceLessThanYear => 'Менее 1 года';

  @override
  String get experienceOneToThree => '1–3 года';

  @override
  String get experienceThreeToFive => '3–5 лет';

  @override
  String get experienceFiveToTen => '5–10 лет';

  @override
  String get experienceMoreThanTen => 'Более 10 лет';

  @override
  String get formatChat => 'Чат';

  @override
  String get formatAudio => 'Аудио';

  @override
  String get formatVideo => 'Видео';

  @override
  String get onboardingTopicsTitle => 'Анкета специалиста — шаг 2 из 2';

  @override
  String get onboardingTopicsHint =>
      'Выберите темы консультаций, с которыми вы работаете';

  @override
  String get documentsScreenTitle => 'Документы верификации';

  @override
  String get documentTypeIdentity => 'Удостоверение личности';

  @override
  String get documentTypeDiploma => 'Диплом об образовании';

  @override
  String get documentTypeCertificates => 'Сертификаты';

  @override
  String get documentTypeQualification => 'Подтверждение квалификации';

  @override
  String get documentStatusNotUploaded => 'Не загружен';

  @override
  String get documentStatusUploaded => 'На проверке';

  @override
  String get documentStatusApproved => 'Принят';

  @override
  String get documentStatusReuploadRequired => 'Нужна переотправка';

  @override
  String get documentTooLarge =>
      'Файл больше 10 МБ — выберите файл меньшего размера';

  @override
  String get actionSubmitForReview => 'Отправить на проверку';

  @override
  String get actionUpload => 'Загрузить';

  @override
  String get actionReplace => 'Заменить';

  @override
  String get photoScreenTitle => 'Фото профиля';

  @override
  String get actionUploadPhoto => 'Загрузить фото';

  @override
  String get actionDeletePhoto => 'Удалить фото';

  @override
  String get photoStatusNone => 'Фото не загружено';

  @override
  String get photoStatusPending => 'Фото отправлено на проверку';

  @override
  String get photoStatusApproved => 'Фото одобрено';

  @override
  String get photoStatusRejected => 'Фото отклонено';

  @override
  String get verificationScreenTitle => 'Статус верификации';

  @override
  String get verificationDraft => 'Анкета не отправлена';

  @override
  String get verificationPending =>
      'Анкета на проверке. Срок рассмотрения — до 24 часов';

  @override
  String get verificationVerified => 'Верификация пройдена';

  @override
  String get fieldPhoto => 'Фото';

  @override
  String get fieldAbout => 'О себе';

  @override
  String fieldStatusNone(String field) {
    return '$field: не заполнено';
  }

  @override
  String fieldStatusPending(String field) {
    return '$field: на проверке';
  }

  @override
  String fieldStatusApproved(String field) {
    return '$field: одобрено';
  }

  @override
  String fieldStatusRejected(String field) {
    return '$field: отклонено';
  }

  @override
  String get actionReupload => 'Загрузить заново';

  @override
  String get weekdayMon => 'Пн';

  @override
  String get weekdayTue => 'Вт';

  @override
  String get weekdayWed => 'Ср';

  @override
  String get weekdayThu => 'Чт';

  @override
  String get weekdayFri => 'Пт';

  @override
  String get weekdaySat => 'Сб';

  @override
  String get weekdaySun => 'Вс';

  @override
  String get scheduleScreenTitle => 'Расписание';

  @override
  String get scheduleStart => 'Начало';

  @override
  String get scheduleEnd => 'Конец';

  @override
  String get scheduleBreakStart => 'Перерыв с';

  @override
  String get scheduleBreakEnd => 'Перерыв до';

  @override
  String get actionClearBreak => 'Убрать перерыв';

  @override
  String get actionSave => 'Сохранить';

  @override
  String get exceptionsScreenTitle => 'Исключения в расписании';

  @override
  String get scheduleDayOff => 'Выходной';

  @override
  String get actionMakeDayOff => 'Сделать выходным';

  @override
  String get actionCustomHours => 'Другие часы работы';

  @override
  String get actionRemoveException => 'Убрать исключение';

  @override
  String get homeScreenTitle => 'Главная';

  @override
  String get homeAcceptingBlockedByVerification =>
      'Приём заявок откроется после проверки анкеты';

  @override
  String get homeAcceptingOn => 'Приём заявок включён';

  @override
  String get homeAcceptingOff => 'Приём заявок выключен';

  @override
  String get homeNavConsultations => 'Заявки и консультации';

  @override
  String get homeNavEarnings => 'Доход';

  @override
  String get homeNavReviews => 'Отзывы';

  @override
  String get offerEmergencyBadge => 'Срочный запрос';

  @override
  String get offerNewTitle => 'Новый оффер';

  @override
  String secondsShort(int seconds) {
    return '$seconds с';
  }

  @override
  String get actionDecline => 'Отклонить';

  @override
  String get actionAccept => 'Принять';

  @override
  String get offersEmpty => 'Пока нет новых заявок';

  @override
  String get consultationsScreenTitle => 'Заявки и консультации';

  @override
  String get consultationsTabOffers => 'Заявки';

  @override
  String get consultationsTabActive => 'Идёт/Плановые';

  @override
  String get consultationsTabHistory => 'История';

  @override
  String get listEmpty => 'Пусто';

  @override
  String clientCode(int code) {
    return 'Клиент #$code';
  }

  @override
  String get consultationStatusScheduled => 'Плановая запись';

  @override
  String get consultationStatusActive => 'Идёт сейчас';

  @override
  String get consultationStatusCompleted => 'Завершена';

  @override
  String get consultationStatusCancelled => 'Отменена';

  @override
  String get noteEditorTitle => 'Приватная заметка';

  @override
  String get noteEditorHint =>
      'Видна только вам. Не используйте медицинские диагнозы.';

  @override
  String get outcomeSheetTitle => 'Завершить консультацию';

  @override
  String get outcomeCompleted => 'Консультация состоялась';

  @override
  String get outcomeClientNoShow => 'Клиент не пришёл';

  @override
  String get outcomeClientCancelled => 'Клиент отменил';

  @override
  String get outcomeTechIssue => 'Технический сбой';

  @override
  String get consultationFinished => 'Консультация завершена';

  @override
  String get callScreenTitle => 'Звонок';

  @override
  String get callConnecting => 'Подключение…';

  @override
  String get callReconnecting => 'Связь восстанавливается…';

  @override
  String get callInProgress => 'Звонок идёт';

  @override
  String get callMicDenied => 'Нет доступа к микрофону';

  @override
  String get actionOpenSettings => 'Открыть настройки';

  @override
  String get actionBackToChat => 'Вернуться в чат';

  @override
  String get callOfferChatFallback =>
      'Связь не восстановилась — продолжите в чате';

  @override
  String get callFailed => 'Звонок не удался';

  @override
  String sessionHeaderTitle(int code, String topic) {
    return 'Клиент #$code · $topic';
  }

  @override
  String get earningsScreenTitle => 'Доход';

  @override
  String get earningsBalance => 'Баланс';

  @override
  String get actionWithdraw => 'Вывести';

  @override
  String get earningsEmpty => 'Пока нет начислений';

  @override
  String earningsCommission(String amount) {
    return 'Комиссия: $amount';
  }

  @override
  String get payoutScreenTitle => 'Вывод средств';

  @override
  String get payoutPendingReview => 'Заявка на проверке у финконтроля';

  @override
  String get payoutProcessing => 'Заявка одобрена, отправлена на выплату';

  @override
  String get payoutPaid => 'Выплачено';

  @override
  String payoutRejected(String reason) {
    return 'Заявка отклонена: $reason';
  }

  @override
  String get payoutAmountLabel => 'Сумма, ₸';

  @override
  String get payoutPanLabel => 'Номер карты';

  @override
  String get payoutHolderLabel => 'Имя держателя';

  @override
  String get payoutErrorAmountTooLow => 'Сумма должна быть больше нуля';

  @override
  String get payoutErrorInvalidPan => 'Неверный номер карты';

  @override
  String get payoutErrorInvalidExpiry => 'Неверный срок действия (MM/YY)';

  @override
  String get actionSubmitPayout => 'Отправить заявку';

  @override
  String get reviewsScreenTitle => 'Отзывы';

  @override
  String reviewsCount(int count) {
    return '$count отзывов';
  }

  @override
  String get reviewsEmpty => 'Пока нет отзывов';

  @override
  String get reviewYourReply => 'Ваш ответ';

  @override
  String get reviewActionReply => 'Ответить';

  @override
  String get reviewActionEditReply => 'Изменить ответ';

  @override
  String get reviewActionComplaint => 'Пожаловаться';

  @override
  String get reviewReplyDialogTitle => 'Ответ на отзыв';

  @override
  String get reviewReplyHint =>
      'Ответ увидят все — не упоминайте детали консультации. До 1000 символов.';

  @override
  String get reviewReplySaved => 'Ответ сохранён';

  @override
  String get reviewComplaintDialogTitle => 'Жалоба на отзыв';

  @override
  String get reviewComplaintHint =>
      'Опишите, почему отзыв нарушает правила. Отзыв скроют и исключат из рейтинга до решения модератора.';

  @override
  String get reviewComplaintSent =>
      'Жалоба отправлена, отзыв скрыт до решения модератора';

  @override
  String get actionCancel => 'Отмена';

  @override
  String get notificationsScreenTitle => 'Уведомления';

  @override
  String get actionMarkAllRead => 'Прочитать все';

  @override
  String get notificationsEmpty => 'Пока нет уведомлений';

  @override
  String get profileScreenTitle => 'Профиль';

  @override
  String get profileLanguage => 'Язык';

  @override
  String get actionLogout => 'Выйти';

  @override
  String get webPresenceNotice =>
      'Заявки приходят, пока открыта эта вкладка. Закроете — приём выключится, и клиент вас не увидит.';

  @override
  String get offersScreenTitle => 'Заявки';

  @override
  String get devicesTitle => 'Проверьте камеру и микрофон';

  @override
  String get devicesCamera => 'Камера';

  @override
  String get devicesMicrophone => 'Микрофон';

  @override
  String get devicesJoin => 'Войти в консультацию';

  @override
  String get devicesNotFound =>
      'Камера и микрофон не найдены. Разрешите доступ в браузере и попробуйте снова.';

  @override
  String get dashboardStatToday => 'Сегодня';

  @override
  String get dashboardStatCompleted => 'Завершено';

  @override
  String get dashboardStatEarned => 'Доход сегодня';

  @override
  String get dashboardStatRating => 'Рейтинг';

  @override
  String get dashboardNextTitle => 'Ближайшая консультация';

  @override
  String get dashboardOpenConsultation => 'Открыть консультацию';

  @override
  String dashboardGreeting(String name) {
    return 'Здравствуйте, $name 👋';
  }

  @override
  String dashboardTodayCount(int count) {
    return 'Сегодня у вас $count консультаций';
  }

  @override
  String get earningsStatTotal => 'Доход за период';

  @override
  String get earningsStatCount => 'Консультаций';

  @override
  String get earningsStatAverage => 'Средний чек';

  @override
  String get earningsStatCommission => 'Комиссия платформы';

  @override
  String get actionSend => 'Отправить';

  @override
  String get emergencyDisclaimerText =>
      'Платформа не заменяет экстренные службы. Если жизни или здоровью угрожает опасность, звоните напрямую:';

  @override
  String get errorGeneric => 'Что-то пошло не так';

  @override
  String get supportEmpty => 'Обращений пока нет';

  @override
  String get supportNewTicket => 'Новое обращение';

  @override
  String get supportNoReplyNotice =>
      'Дописать в это обращение нельзя — если нужно добавить детали, создайте новое';

  @override
  String get supportTitle => 'Поддержка';

  @override
  String get ticketAuthorStaff => 'Поддержка';

  @override
  String get ticketAuthorYou => 'Вы';

  @override
  String get ticketBodyInvalid => 'Опишите ситуацию подробнее';

  @override
  String get ticketBodyLabel => 'Опишите ситуацию';

  @override
  String get ticketCategoryAccountData => 'Аккаунт и данные';

  @override
  String get ticketCategoryConsultations => 'Консультации';

  @override
  String get ticketCategoryLabel => 'Категория';

  @override
  String get ticketCategoryOther => 'Другое';

  @override
  String get ticketCategoryPayment => 'Оплата';

  @override
  String get ticketCategorySecurity => 'Безопасность';

  @override
  String get ticketCategoryTechnical => 'Технические проблемы';

  @override
  String get ticketStatusInProgress => 'В работе';

  @override
  String get ticketStatusNew => 'Новое';

  @override
  String get ticketStatusResolved => 'Решено';

  @override
  String get ticketSubjectInvalid => 'Укажите тему обращения';

  @override
  String get ticketSubjectLabel => 'Тема';
}
