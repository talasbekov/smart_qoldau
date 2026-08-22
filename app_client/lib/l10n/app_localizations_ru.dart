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

  @override
  String get emergencyScreeningTitle => 'Вам угрожает опасность прямо сейчас?';

  @override
  String get emergencyScreeningBody =>
      'Ответьте честно — от этого зависит, чем мы поможем в первую очередь';

  @override
  String get emergencyScreeningFormatHint => 'Формат подбора можно сменить';

  @override
  String get actionYes => 'Да';

  @override
  String get actionNo => 'Нет';

  @override
  String get emergencyDangerTitle =>
      'Если есть угроза жизни — звоните напрямую';

  @override
  String get emergencyDangerBody =>
      'Платформа не заменяет экстренные службы. Позвоните по одному из номеров — это быстрее всего';

  @override
  String get emergencyCallPolice => 'Позвонить 102';

  @override
  String get emergencyCallAmbulance => 'Позвонить 103';

  @override
  String get emergencyContinueSearch =>
      'Мне не угрожает опасность, продолжить подбор';

  @override
  String get emergencySearchBadge => 'Приоритетный поиск';

  @override
  String get emergencySearchTitle => 'Ищем свободного специалиста для вас';

  @override
  String get emergencySearchSubtitle =>
      'Мы соединим вас первым в очереди. Если станет тяжело — можно позвонить на 103';

  @override
  String get emergencySearchEncouragement =>
      'Вы не одни — мы уже подключаем специалиста';

  @override
  String get emergencyCallServices => 'Позвонить 103 / 112';

  @override
  String get hotlinesTitle => 'Мы перезвоним вам';

  @override
  String get hotlinesBody =>
      'Заявка на обратный звонок уже оформлена — с вами свяжется первый освободившийся специалист. Пока можно позвонить:';

  @override
  String hotlineCall(String number) {
    return 'Позвонить $number';
  }

  @override
  String get hotlineName150 => 'Телефон доверия';

  @override
  String get hotlineName103 => 'Скорая помощь';

  @override
  String get hotlineName112 => 'Единая служба спасения';

  @override
  String get foundTitle => 'Специалист найден!';

  @override
  String get foundOnline => 'Сейчас на связи';

  @override
  String get foundStart => 'Начать консультацию';

  @override
  String get foundCancel => 'Отменить консультацию';

  @override
  String expertLanguages(String languages) {
    return 'Языки: $languages';
  }

  @override
  String get expertExperienceLabel => 'Опыт';

  @override
  String get experienceLessThanYear => 'менее года';

  @override
  String get experienceOneToThree => '1–3 года';

  @override
  String get experienceThreeToFive => '3–5 лет';

  @override
  String get experienceFiveToTen => '5–10 лет';

  @override
  String get experienceMoreThanTen => 'более 10 лет';

  @override
  String get paymentSheetTitle => 'Оплата консультации';

  @override
  String get paymentLineItem => 'Консультация';

  @override
  String get paymentEscrowNote =>
      'Деньги замораживаются на карте и списываются только после состоявшейся консультации';

  @override
  String get paymentPay => 'Оплатить';

  @override
  String get paymentAddCard => 'Добавить карту';

  @override
  String get paymentNoCards => 'Пока нет привязанных карт';

  @override
  String get paymentDeclinedTitle => 'Платёж отклонён';

  @override
  String get paymentAnotherCard => 'Другая карта';

  @override
  String get cardsTitle => 'Мои карты';

  @override
  String get cardsEmpty => 'Карт пока нет';

  @override
  String get cardDeleteTitle => 'Открепить карту?';

  @override
  String cardDeleteBody(String maskedPan) {
    return 'Карта $maskedPan больше не будет доступна для оплаты';
  }

  @override
  String get actionDelete => 'Открепить';

  @override
  String get actionSave => 'Сохранить';

  @override
  String get addCardTitle => 'Новая карта';

  @override
  String get cardNumberLabel => 'Номер карты';

  @override
  String get cardExpiryLabel => 'Срок действия';

  @override
  String get cardHolderLabel => 'Имя на карте';

  @override
  String get cardNumberInvalid => 'Проверьте номер карты';

  @override
  String get cardExpiryInvalid => 'Срок действия в формате ММ/ГГ';

  @override
  String get cardHolderInvalid => 'Укажите имя, как на карте';

  @override
  String paymentDuration(num minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes минуты',
      many: '$minutes минут',
      few: '$minutes минуты',
      one: '$minutes минута',
    );
    return '$_temp0';
  }

  @override
  String expertReviewsCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count отзыва',
      many: '$count отзывов',
      few: '$count отзыва',
      one: '$count отзыв',
    );
    return '$_temp0';
  }

  @override
  String get chatInputHint => 'Напишите сообщение...';

  @override
  String get chatConfidentialNotice =>
      'Здесь безопасно говорить открыто. Все сообщения конфиденциальны';

  @override
  String get chatSending => 'отправляется';

  @override
  String get chatFailed => 'не отправлено';

  @override
  String get chatPeerTyping => 'печатает…';

  @override
  String get chatInputDisabled =>
      'Консультация завершена — писать больше нельзя';

  @override
  String get sessionOnline => 'На связи';

  @override
  String sessionRemaining(String time) {
    return 'Осталось $time';
  }

  @override
  String get sessionTimeUp => 'Время консультации истекло';

  @override
  String get sessionCancelTitle => 'Отменить консультацию?';

  @override
  String get sessionCancelBody => 'Время освободится для другого пользователя';

  @override
  String get sessionMenuCancel => 'Отменить консультацию';

  @override
  String get callAudioTitle => 'Аудиоконсультация';

  @override
  String get callVideoTitle => 'Видеоконсультация';

  @override
  String get callConnecting => 'Соединяем…';

  @override
  String get callConnected => 'На связи';

  @override
  String get callReconnecting =>
      'Связь восстанавливается, собеседник останется на линии';

  @override
  String get callFailedTitle => 'Связь не восстановилась';

  @override
  String get callContinueInChat => 'Продолжить в чате';

  @override
  String get callEnd => 'Завершить';

  @override
  String get callMic => 'Микрофон';

  @override
  String get callCamera => 'Камера';

  @override
  String get callCameraBlocked => 'Камера недоступна — идёт аудиоразговор';

  @override
  String get callPermissionTitle => 'Нужен доступ к микрофону';

  @override
  String get callPermissionBody =>
      'Без микрофона аудио- или видеоконсультацию провести нельзя. Разрешение можно выдать в настройках приложения';

  @override
  String get callOpenSettings => 'Открыть настройки';

  @override
  String get sessionMenuAudio => 'Перейти в аудио';

  @override
  String get sessionMenuVideo => 'Перейти в видео';

  @override
  String get reviewTitle => 'Спасибо, что доверяете SmartQoldau';

  @override
  String get reviewRatingQuestion => 'Как прошла консультация?';

  @override
  String get reviewPublicLabel => 'Публичный отзыв';

  @override
  String get reviewPublicHint => 'Виден другим клиентам, без вашего имени';

  @override
  String get reviewPrivateLabel => 'Приватно команде качества';

  @override
  String get reviewPrivateHint =>
      'Отзыв видит только команда качества SmartQoldau — психолог его не увидит';

  @override
  String get reviewSend => 'Завершить';

  @override
  String get reviewSkip => 'Пропустить';

  @override
  String get reviewContinueSameExpert => 'Продолжить с тем же психологом';

  @override
  String get reviewExistsTitle => 'Вы уже оценили эту консультацию';

  @override
  String get reviewRating1 => 'Плохо';

  @override
  String get reviewRating2 => 'Так себе';

  @override
  String get reviewRating3 => 'Нормально';

  @override
  String get reviewRating4 => 'Хорошо';

  @override
  String get reviewRating5 => 'Отлично';

  @override
  String get catalogTitle => 'Специалисты';

  @override
  String get catalogFilters => 'Фильтры';

  @override
  String get catalogEmpty => 'По этим фильтрам никого не нашлось';

  @override
  String get catalogResetFilters => 'Сбросить фильтры';

  @override
  String get filterTopic => 'Тема';

  @override
  String get filterLanguage => 'Язык';

  @override
  String get filterFormat => 'Формат';

  @override
  String get filterSort => 'Сортировка';

  @override
  String get filterAny => 'Любой';

  @override
  String get sortPriceAsc => 'Сначала дешевле';

  @override
  String get sortPriceDesc => 'Сначала дороже';

  @override
  String get sortRating => 'По рейтингу';

  @override
  String get actionApply => 'Применить';

  @override
  String get favoritesTitle => 'Избранное';

  @override
  String get favoritesEmpty => 'Пока никого не добавили';

  @override
  String get expertTopicsTitle => 'Темы';

  @override
  String get expertReviewsTitle => 'Отзывы';

  @override
  String get expertNoReviews => 'Отзывов пока нет';

  @override
  String get expertReplyPrefix => 'Ответ специалиста';

  @override
  String get expertBook => 'Записаться';

  @override
  String get expertPriceLabel => 'Консультация';

  @override
  String get expertUnavailableTitle => 'Специалист сейчас недоступен';

  @override
  String get expertUnavailableBody =>
      'Можно подобрать другого свободного специалиста по этой же теме';

  @override
  String get expertPickAutomatically => 'Подобрать автоматически';

  @override
  String get expertLoadMoreReviews => 'Показать ещё отзывы';

  @override
  String get consultationsActiveTab => 'Активные';

  @override
  String get consultationsHistoryTab => 'История';

  @override
  String get consultationsEmptyActive => 'Активных консультаций нет';

  @override
  String get consultationsEmptyHistory => 'История пока пуста';

  @override
  String get consultationContinue => 'Продолжить';

  @override
  String get consultationCancel => 'Отменить';

  @override
  String get consultationRepeat => 'Повторить запись';

  @override
  String get consultationDetailsTitle => 'Консультация';

  @override
  String get consultationLoadMore => 'Показать ещё';

  @override
  String get paymentStatusHeld => 'Деньги заморожены';

  @override
  String get paymentStatusCaptured => 'Оплачено';

  @override
  String get paymentStatusVoided => 'Возвращено';

  @override
  String get paymentStatusFailed => 'Оплата не прошла';

  @override
  String get paymentStatusUnpaid => 'Ожидает оплаты';

  @override
  String paymentPaidWithCard(String maskedPan) {
    return 'Оплачено картой $maskedPan';
  }

  @override
  String get consultationStatusActive => 'Идёт';

  @override
  String get consultationStatusCompleted => 'Завершена';

  @override
  String get consultationStatusCancelled => 'Отменена';

  @override
  String get outcomeCompleted => 'Состоялась';

  @override
  String get outcomeClientNoShow => 'Вы не подключились';

  @override
  String get outcomeClientCancelled => 'Отменена вами';

  @override
  String get outcomeTechIssue => 'Технический сбой';

  @override
  String get myReviewTitle => 'Ваш отзыв';

  @override
  String get reviewDeleteTitle => 'Удалить отзыв?';

  @override
  String get reviewDeleteBody => 'Рейтинг специалиста будет пересчитан';

  @override
  String get reviewDelete => 'Удалить отзыв';

  @override
  String get funnelActiveRequestGoTo => 'Перейти к консультации';

  @override
  String get notificationsTitle => 'Уведомления';

  @override
  String get notificationsEmpty => 'Уведомлений пока нет';

  @override
  String get notificationsMarkAllRead => 'Прочитать все';

  @override
  String get profileGuestTitle => 'Создайте аккаунт';

  @override
  String get profileGuestBody =>
      'Активная консультация и привязанная карта сохранятся, а доступ к истории останется при смене устройства';

  @override
  String get profileCreateAccount => 'Создать аккаунт';

  @override
  String profileCompletedConsultations(num count) {
    return 'Завершённых консультаций: $count';
  }

  @override
  String get profilePaymentMethods => 'Способы оплаты';

  @override
  String get profileNotifications => 'Уведомления';

  @override
  String get profileLanguage => 'Язык';

  @override
  String get profileSupport => 'Поддержка';

  @override
  String get profileTerms => 'Пользовательское соглашение';

  @override
  String get profilePrivacy => 'Политика конфиденциальности';

  @override
  String get profileDeleteAccount => 'Удалить аккаунт';

  @override
  String get profileLogout => 'Выйти';

  @override
  String get profileLogoutTitle => 'Выйти из аккаунта?';

  @override
  String get profileLogoutBody => 'Вы сможете войти снова по номеру телефона';

  @override
  String get profileLogoutGuestBody =>
      'Это гостевая сессия: после выхода её данные будут потеряны безвозвратно — история консультаций и привязанная карта не восстановятся';

  @override
  String get profileDeleteAccountTitle => 'Удалить аккаунт и данные?';

  @override
  String get profileDeleteAccountBody =>
      'Мы создадим обращение в поддержку — команда свяжется с вами и подтвердит удаление';

  @override
  String get profileDeleteAccountSubject => 'Удаление аккаунта и данных';

  @override
  String get profileDeleteAccountTicketBody =>
      'Прошу удалить мой аккаунт и связанные с ним данные';

  @override
  String get convertGuestTitle => 'Создание аккаунта';

  @override
  String get convertGuestPhoneAlreadyUsed =>
      'Этот номер уже зарегистрирован. Войти в тот аккаунт можно на экране входа, но данные гостевой сессии в него не перенесутся';

  @override
  String get supportTitle => 'Поддержка';

  @override
  String get supportEmpty => 'Обращений пока нет';

  @override
  String get supportNewTicket => 'Новое обращение';

  @override
  String get supportNoReplyNotice =>
      'Дописать в это обращение нельзя — если нужно добавить детали, создайте новое';

  @override
  String get ticketSubjectLabel => 'Тема';

  @override
  String get ticketBodyLabel => 'Опишите ситуацию';

  @override
  String get ticketCategoryLabel => 'Категория';

  @override
  String get ticketSubjectInvalid => 'Укажите тему обращения';

  @override
  String get ticketBodyInvalid => 'Опишите ситуацию подробнее';

  @override
  String get ticketAuthorYou => 'Вы';

  @override
  String get ticketAuthorStaff => 'Поддержка';

  @override
  String get ticketStatusNew => 'Новое';

  @override
  String get ticketStatusInProgress => 'В работе';

  @override
  String get ticketStatusResolved => 'Решено';

  @override
  String get ticketCategoryConsultations => 'Консультации';

  @override
  String get ticketCategoryPayment => 'Оплата';

  @override
  String get ticketCategoryTechnical => 'Технические проблемы';

  @override
  String get ticketCategoryAccountData => 'Аккаунт и данные';

  @override
  String get ticketCategorySecurity => 'Безопасность';

  @override
  String get ticketCategoryOther => 'Другое';

  @override
  String get actionSend => 'Отправить';

  @override
  String get sessionMenuReport => 'Сообщить о проблеме';

  @override
  String get languageEnglish => 'Английский';
}
