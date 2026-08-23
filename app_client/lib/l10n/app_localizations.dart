import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_kk.dart';
import 'app_localizations_ru.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('kk'),
    Locale('ru'),
  ];

  /// Название приложения — заголовок окна/задачи ОС
  ///
  /// In ru, this message translates to:
  /// **'SmartQoldau'**
  String get appTitle;

  /// Кнопка перехода к следующему шагу
  ///
  /// In ru, this message translates to:
  /// **'Продолжить'**
  String get actionContinue;

  /// Кнопка отмены текущего действия
  ///
  /// In ru, this message translates to:
  /// **'Отмена'**
  String get actionCancel;

  /// Кнопка повторной попытки после ошибки
  ///
  /// In ru, this message translates to:
  /// **'Повторить'**
  String get actionRetry;

  /// Кнопка закрытия диалога или экрана
  ///
  /// In ru, this message translates to:
  /// **'Закрыть'**
  String get actionClose;

  /// Кнопка завершения шага или сценария
  ///
  /// In ru, this message translates to:
  /// **'Готово'**
  String get actionDone;

  /// Название русского языка в переключателе языка интерфейса
  ///
  /// In ru, this message translates to:
  /// **'Русский'**
  String get languageRussian;

  /// Название казахского языка в переключателе языка интерфейса
  ///
  /// In ru, this message translates to:
  /// **'Қазақша'**
  String get languageKazakh;

  /// Текст-заглушка для непредвиденной ошибки без более точного объяснения
  ///
  /// In ru, this message translates to:
  /// **'Что-то пошло не так'**
  String get errorGeneric;

  /// VALIDATION_FAILED — ошибка валидации запроса
  ///
  /// In ru, this message translates to:
  /// **'Проверьте введённые данные'**
  String get errorValidationFailed;

  /// UNAUTHORIZED — истёкшая или недействительная сессия
  ///
  /// In ru, this message translates to:
  /// **'Сессия истекла, войдите заново'**
  String get errorUnauthorized;

  /// FORBIDDEN — действие запрещено для текущего пользователя
  ///
  /// In ru, this message translates to:
  /// **'Недостаточно прав для этого действия'**
  String get errorForbidden;

  /// NOT_FOUND — общий код отсутствия ресурса
  ///
  /// In ru, this message translates to:
  /// **'Запрашиваемые данные не найдены'**
  String get errorNotFound;

  /// CONFLICT — общий код конфликта состояния
  ///
  /// In ru, this message translates to:
  /// **'Действие конфликтует с текущим состоянием'**
  String get errorConflict;

  /// RATE_LIMITED — общий код превышения частоты запросов
  ///
  /// In ru, this message translates to:
  /// **'Слишком много попыток, подождите немного'**
  String get errorRateLimited;

  /// INTERNAL — внутренняя ошибка сервера
  ///
  /// In ru, this message translates to:
  /// **'Ошибка на сервере, попробуйте позже'**
  String get errorInternal;

  /// SMS_CODE_INVALID — введённый SMS-код не совпадает с отправленным
  ///
  /// In ru, this message translates to:
  /// **'Неверный код'**
  String get errorSmsCodeInvalid;

  /// SMS_CODE_EXPIRED — SMS-код больше не действителен
  ///
  /// In ru, this message translates to:
  /// **'Код истёк, запросите новый'**
  String get errorSmsCodeExpired;

  /// SMS_RATE_LIMITED — повторная отправка SMS-кода запрошена раньше 45 секунд (Р-10)
  ///
  /// In ru, this message translates to:
  /// **'Слишком много попыток, повторите чуть позже'**
  String get errorSmsRateLimited;

  /// PHONE_ALREADY_REGISTERED — телефон уже привязан к другому аккаунту
  ///
  /// In ru, this message translates to:
  /// **'Этот номер уже зарегистрирован'**
  String get errorPhoneAlreadyRegistered;

  /// ACTIVE_REQUEST_EXISTS — у клиента уже есть незавершённая заявка на подбор эксперта
  ///
  /// In ru, this message translates to:
  /// **'У вас уже есть активная заявка'**
  String get errorActiveRequestExists;

  /// EXPERT_UNAVAILABLE — эксперт временно не принимает консультации
  ///
  /// In ru, this message translates to:
  /// **'Эксперт сейчас недоступен'**
  String get errorExpertUnavailable;

  /// EXPERT_NOT_FOUND — эксперт с таким идентификатором не существует
  ///
  /// In ru, this message translates to:
  /// **'Эксперт не найден'**
  String get errorExpertNotFound;

  /// EXPERT_BLOCKED — эксперт заблокирован и недоступен для новых консультаций
  ///
  /// In ru, this message translates to:
  /// **'Эксперт недоступен для консультаций'**
  String get errorExpertBlocked;

  /// REQUEST_NOT_FOUND — заявка на подбор эксперта не найдена
  ///
  /// In ru, this message translates to:
  /// **'Заявка не найдена'**
  String get errorRequestNotFound;

  /// REQUEST_ALREADY_CLOSED — заявка уже завершена или отменена
  ///
  /// In ru, this message translates to:
  /// **'Заявка уже закрыта'**
  String get errorRequestAlreadyClosed;

  /// CONSULTATION_NOT_FOUND — консультация с таким идентификатором не существует
  ///
  /// In ru, this message translates to:
  /// **'Консультация не найдена'**
  String get errorConsultationNotFound;

  /// CONSULTATION_NOT_ACTIVE — действие недоступно для неактивной консультации
  ///
  /// In ru, this message translates to:
  /// **'Консультация уже завершена'**
  String get errorConsultationNotActive;

  /// PAYMENT_METHOD_NOT_FOUND — сохранённый способ оплаты не найден
  ///
  /// In ru, this message translates to:
  /// **'Способ оплаты не найден'**
  String get errorPaymentMethodNotFound;

  /// PAYMENT_NOT_FOUND — платёж с таким идентификатором не найден
  ///
  /// In ru, this message translates to:
  /// **'Платёж не найден'**
  String get errorPaymentNotFound;

  /// PROVIDER_DECLINED — платёжный провайдер отклонил операцию
  ///
  /// In ru, this message translates to:
  /// **'Платёж отклонён банком'**
  String get errorProviderDeclined;

  /// ALREADY_PAID — повторная попытка оплаты уже оплаченной консультации
  ///
  /// In ru, this message translates to:
  /// **'Уже оплачено'**
  String get errorAlreadyPaid;

  /// REVIEW_EXISTS — отзыв на эту консультацию уже оставлен
  ///
  /// In ru, this message translates to:
  /// **'Вы уже оставили отзыв'**
  String get errorReviewExists;

  /// REVIEW_NOT_FOUND — отзыв с таким идентификатором не найден
  ///
  /// In ru, this message translates to:
  /// **'Отзыв не найден'**
  String get errorReviewNotFound;

  /// NOTIFICATION_NOT_FOUND — уведомление с таким идентификатором не найдено
  ///
  /// In ru, this message translates to:
  /// **'Уведомление не найдено'**
  String get errorNotificationNotFound;

  /// DEVICE_NOT_FOUND — устройство для push-уведомлений не зарегистрировано
  ///
  /// In ru, this message translates to:
  /// **'Устройство не найдено'**
  String get errorDeviceNotFound;

  /// TICKET_NOT_FOUND — обращение в поддержку с таким идентификатором не найдено
  ///
  /// In ru, this message translates to:
  /// **'Обращение не найдено'**
  String get errorTicketNotFound;

  /// TICKET_CONTACT_REQUIRED — для анонимного обращения не указан контакт для ответа
  ///
  /// In ru, this message translates to:
  /// **'Укажите контакт для связи'**
  String get errorTicketContactRequired;

  /// TICKET_CATEGORY_NOT_ALLOWED — выбранная категория обращения недопустима
  ///
  /// In ru, this message translates to:
  /// **'Эта категория недоступна для обращения'**
  String get errorTicketCategoryNotAllowed;

  /// TICKET_ALREADY_RESOLVED — обращение в поддержку уже закрыто как решённое
  ///
  /// In ru, this message translates to:
  /// **'Обращение уже решено'**
  String get errorTicketAlreadyResolved;

  /// NETWORK — клиентский код сетевого сбоя (таймаут, обрыв соединения, DNS)
  ///
  /// In ru, this message translates to:
  /// **'Нет соединения с сервером'**
  String get errorNetwork;

  /// Слоган под названием приложения на заставке
  ///
  /// In ru, this message translates to:
  /// **'Поддержка рядом, когда она нужна'**
  String get splashTagline;

  /// Заголовок экрана ввода номера телефона
  ///
  /// In ru, this message translates to:
  /// **'Вход по номеру телефона'**
  String get phoneScreenTitle;

  /// Подзаголовок экрана ввода номера телефона
  ///
  /// In ru, this message translates to:
  /// **'Это займёт меньше минуты'**
  String get phoneScreenSubtitle;

  /// Подпись поля ввода номера телефона
  ///
  /// In ru, this message translates to:
  /// **'Номер телефона'**
  String get phoneNumberLabel;

  /// Шаблон-подсказка маски номера телефона в поле ввода (без +7 (7 — тот выведен отдельным несъёмным префиксом поля) — формат цифр не зависит от языка интерфейса
  ///
  /// In ru, this message translates to:
  /// **'XX) XXX-XX-XX'**
  String get phoneNumberHint;

  /// Пояснение под полем ввода номера телефона
  ///
  /// In ru, this message translates to:
  /// **'Пришлём одноразовый код по SMS'**
  String get phoneScreenHelper;

  /// Кнопка отправки SMS-кода на экране ввода номера телефона
  ///
  /// In ru, this message translates to:
  /// **'Получить код'**
  String get actionGetCode;

  /// Заголовок экрана ввода SMS-кода
  ///
  /// In ru, this message translates to:
  /// **'Введите код из SMS'**
  String get codeScreenTitle;

  /// Подзаголовок экрана ввода SMS-кода — номер, на который отправлен код
  ///
  /// In ru, this message translates to:
  /// **'Код отправлен на номер {phone}'**
  String codeScreenSubtitle(String phone);

  /// Кнопка повторной отправки SMS-кода, доступна после обратного отсчёта
  ///
  /// In ru, this message translates to:
  /// **'Отправить повторно'**
  String get actionResendCode;

  /// Текст кнопки повторной отправки SMS-кода во время обратного отсчёта (Р-10 — 45 секунд)
  ///
  /// In ru, this message translates to:
  /// **'Отправить повторно через {seconds} с'**
  String resendCodeCountdown(int seconds);

  /// Заголовок экрана приветствия — точки входа для неавторизованного пользователя
  ///
  /// In ru, this message translates to:
  /// **'Добро пожаловать в SmartQoldau'**
  String get welcomeTitle;

  /// Ценностное предложение под заголовком экрана приветствия
  ///
  /// In ru, this message translates to:
  /// **'Психологическая поддержка рядом — говорите об этом, когда будете готовы'**
  String get welcomeSubtitle;

  /// Кнопка входа по номеру телефона на экране приветствия
  ///
  /// In ru, this message translates to:
  /// **'Войти по номеру'**
  String get actionLoginByPhone;

  /// Кнопка анонимного (гостевого) входа на экране приветствия — равноправна кнопке входа по номеру (БП-10)
  ///
  /// In ru, this message translates to:
  /// **'Продолжить анонимно'**
  String get actionContinueAnonymously;

  /// Ссылка на страницу пользовательского соглашения на экране приветствия
  ///
  /// In ru, this message translates to:
  /// **'Пользовательское соглашение'**
  String get welcomeTermsLink;

  /// Ссылка на страницу политики конфиденциальности на экране приветствия
  ///
  /// In ru, this message translates to:
  /// **'Политика конфиденциальности'**
  String get welcomePrivacyLink;

  /// Заголовок первого вводного слайда онбординга — форматы консультаций
  ///
  /// In ru, this message translates to:
  /// **'Разные форматы консультаций'**
  String get slidesTitle1;

  /// Описание первого вводного слайда онбординга — форматы консультаций
  ///
  /// In ru, this message translates to:
  /// **'Общайтесь с психологом в чате, по аудио или видео — выбирайте удобный формат'**
  String get slidesDescription1;

  /// Заголовок второго вводного слайда онбординга — конфиденциальность и анонимность
  ///
  /// In ru, this message translates to:
  /// **'Конфиденциально и анонимно'**
  String get slidesTitle2;

  /// Описание второго вводного слайда онбординга — конфиденциальность и анонимность
  ///
  /// In ru, this message translates to:
  /// **'Можно обратиться без регистрации: имя указывать не обязательно, данные защищены'**
  String get slidesDescription2;

  /// Заголовок третьего вводного слайда онбординга — скорость ответа
  ///
  /// In ru, this message translates to:
  /// **'Ответ за 1–2 минуты'**
  String get slidesTitle3;

  /// Описание третьего вводного слайда онбординга — скорость ответа
  ///
  /// In ru, this message translates to:
  /// **'Психолог выходит на связь почти сразу — не нужно ждать часами'**
  String get slidesDescription3;

  /// Кнопка пропуска вводных слайдов онбординга
  ///
  /// In ru, this message translates to:
  /// **'Пропустить'**
  String get slidesSkip;

  /// Кнопка перехода к следующему вводному слайду онбординга
  ///
  /// In ru, this message translates to:
  /// **'Далее'**
  String get slidesNext;

  /// Кнопка завершения вводных слайдов онбординга на последнем слайде
  ///
  /// In ru, this message translates to:
  /// **'Начать'**
  String get slidesStart;

  /// Заголовок экрана запроса разрешений онбординга
  ///
  /// In ru, this message translates to:
  /// **'Разрешения'**
  String get permissionsTitle;

  /// Пояснение под заголовком экрана запроса разрешений — отказ не блокирует вход
  ///
  /// In ru, this message translates to:
  /// **'Пригодится в звонках с психологом — эти разрешения можно настроить и позже'**
  String get permissionsSubtitle;

  /// Название разрешения на доступ к микрофону на экране запроса разрешений
  ///
  /// In ru, this message translates to:
  /// **'Микрофон'**
  String get permissionMicrophoneTitle;

  /// Объяснение, зачем нужен доступ к микрофону
  ///
  /// In ru, this message translates to:
  /// **'Нужен для аудиоконсультаций с психологом'**
  String get permissionMicrophoneDescription;

  /// Название разрешения на доступ к камере на экране запроса разрешений
  ///
  /// In ru, this message translates to:
  /// **'Камера'**
  String get permissionCameraTitle;

  /// Объяснение, зачем нужен доступ к камере
  ///
  /// In ru, this message translates to:
  /// **'Нужна для видеоконсультаций с психологом'**
  String get permissionCameraDescription;

  /// Название разрешения на уведомления на экране запроса разрешений
  ///
  /// In ru, this message translates to:
  /// **'Уведомления'**
  String get permissionNotificationsTitle;

  /// Объяснение, зачем нужны уведомления
  ///
  /// In ru, this message translates to:
  /// **'Сообщим, когда психолог ответит или начнётся консультация'**
  String get permissionNotificationsDescription;

  /// Кнопка предоставления запрошенных разрешений
  ///
  /// In ru, this message translates to:
  /// **'Разрешить'**
  String get actionAllow;

  /// Кнопка пропуска запроса разрешений без блокировки входа
  ///
  /// In ru, this message translates to:
  /// **'Позже'**
  String get actionLater;

  /// Подпись вкладки «Главная» нижней навигации
  ///
  /// In ru, this message translates to:
  /// **'Главная'**
  String get navHome;

  /// Подпись вкладки «Каталог» нижней навигации
  ///
  /// In ru, this message translates to:
  /// **'Каталог'**
  String get navCatalog;

  /// Подпись вкладки «Консультации» нижней навигации
  ///
  /// In ru, this message translates to:
  /// **'Консультации'**
  String get navConsultations;

  /// Подпись вкладки «Профиль» нижней навигации
  ///
  /// In ru, this message translates to:
  /// **'Профиль'**
  String get navProfile;

  /// Заголовок-приветствие в аппбаре главного экрана
  ///
  /// In ru, this message translates to:
  /// **'Здравствуйте'**
  String get homeGreeting;

  /// Текст красной кнопки экстренного сценария на главном экране, ведёт на /emergency
  ///
  /// In ru, this message translates to:
  /// **'Мне нужна помощь сейчас'**
  String get homeEmergencyCta;

  /// Пояснение под кнопкой экстренного сценария на главном экране
  ///
  /// In ru, this message translates to:
  /// **'Среднее время подключения — до 2 минут'**
  String get homeEmergencyCtaSubtitle;

  /// Заголовок над сеткой тем консультаций на главном экране
  ///
  /// In ru, this message translates to:
  /// **'Мы поможем вам с:'**
  String get homeTopicsTitle;

  /// Пояснение под заголовком над сеткой тем консультаций на главном экране (прототип 07-home.png)
  ///
  /// In ru, this message translates to:
  /// **'или расскажите, что именно беспокоит'**
  String get homeTopicsSubtitle;

  /// Заголовок баннера активной консультации на главном экране
  ///
  /// In ru, this message translates to:
  /// **'Активная консультация'**
  String get homeActiveConsultationTitle;

  /// Заголовок информационной панели об экстренной ситуации на главном экране (прототип 07-home.png, ТЗ §4.3)
  ///
  /// In ru, this message translates to:
  /// **'Экстренная ситуация'**
  String get homeEmergencyNoticeTitle;

  /// Текст информационной панели об экстренной ситуации на главном экране
  ///
  /// In ru, this message translates to:
  /// **'У нас есть специалисты, готовые подключиться в приоритетном порядке прямо сейчас'**
  String get homeEmergencyNoticeBody;

  /// Локализованный текст SqEmergencyDisclaimer.disclaimerText (ТЗ §4.3) — виджет из packages/shared не может зависеть от l10n приложения, значение передаётся явно
  ///
  /// In ru, this message translates to:
  /// **'Платформа не заменяет экстренные службы. Если жизни или здоровью угрожает опасность, звоните напрямую:'**
  String get emergencyDisclaimerText;

  /// Заголовок экрана подтверждения темы (прототип 08-topic.png)
  ///
  /// In ru, this message translates to:
  /// **'Расскажите, что вас тревожит'**
  String get topicTitle;

  /// Пояснение под заголовком экрана темы
  ///
  /// In ru, this message translates to:
  /// **'Проверьте тему и выберите формат общения — мы подберём подходящего специалиста'**
  String get topicSubtitle;

  /// Подпись блока выбора формата консультации на экране темы
  ///
  /// In ru, this message translates to:
  /// **'Формат общения'**
  String get topicFormatLabel;

  /// Подпись кнопки выбора формата, пока формат не выбран
  ///
  /// In ru, this message translates to:
  /// **'Выберите формат'**
  String get topicFormatNotChosen;

  /// Название формата консультации: переписка
  ///
  /// In ru, this message translates to:
  /// **'Чат'**
  String get formatChat;

  /// Название формата консультации: аудиозвонок
  ///
  /// In ru, this message translates to:
  /// **'Аудио'**
  String get formatAudio;

  /// Название формата консультации: видеозвонок
  ///
  /// In ru, this message translates to:
  /// **'Видео'**
  String get formatVideo;

  /// Заголовок шторки выбора формата консультации
  ///
  /// In ru, this message translates to:
  /// **'Как вам удобно общаться?'**
  String get formatSheetTitle;

  /// Пояснение под каждым вариантом формата: длительность и что цена индивидуальна
  ///
  /// In ru, this message translates to:
  /// **'50 минут · цена зависит от специалиста'**
  String get formatSheetCaption;

  /// Заголовок диалога при ответе ACTIVE_REQUEST_EXISTS на создание заявки
  ///
  /// In ru, this message translates to:
  /// **'У вас уже есть активная заявка'**
  String get funnelActiveRequestTitle;

  /// Текст диалога при ответе ACTIVE_REQUEST_EXISTS
  ///
  /// In ru, this message translates to:
  /// **'Дождитесь ответа по ней или отмените её, чтобы создать новую'**
  String get funnelActiveRequestBody;

  /// Заголовок экрана поиска специалиста (прототип 09-search.png)
  ///
  /// In ru, this message translates to:
  /// **'Подбираем для вас подходящего психолога'**
  String get searchTitle;

  /// Пояснение под заголовком экрана поиска
  ///
  /// In ru, this message translates to:
  /// **'Это займёт не более 2 минут'**
  String get searchSubtitle;

  /// Второе пояснение на экране поиска — по какому принципу идёт подбор
  ///
  /// In ru, this message translates to:
  /// **'Мы учитываем специализацию, язык и текущую доступность специалиста'**
  String get searchHint;

  /// Подпись над таймером прошедшего времени на экране поиска
  ///
  /// In ru, this message translates to:
  /// **'Идёт поиск'**
  String get searchElapsedLabel;

  /// Поддерживающая строка внизу экрана поиска
  ///
  /// In ru, this message translates to:
  /// **'Вы уже сделали важный шаг, обратившись за помощью'**
  String get searchEncouragement;

  /// Кнопка отмены заявки на экране поиска
  ///
  /// In ru, this message translates to:
  /// **'Отменить поиск'**
  String get searchCancel;

  /// Заголовок экрана, когда заявка закрылась статусом NO_EXPERTS
  ///
  /// In ru, this message translates to:
  /// **'Сейчас нет свободных специалистов'**
  String get noExpertsTitle;

  /// Текст экрана NO_EXPERTS
  ///
  /// In ru, this message translates to:
  /// **'Попробуйте ещё раз через несколько минут или вернитесь на главную'**
  String get noExpertsBody;

  /// Кнопка пересоздания заявки на экране «нет свободных специалистов»
  ///
  /// In ru, this message translates to:
  /// **'Попробовать снова'**
  String get actionTryAgain;

  /// Кнопка возврата на главный экран
  ///
  /// In ru, this message translates to:
  /// **'На главную'**
  String get actionGoHome;

  /// Счётчик доступных специалистов на экране поиска (GET /matching/online-count, задача 9). Форма слова зависит от числа — в русском их четыре
  ///
  /// In ru, this message translates to:
  /// **'Сейчас онлайн: {count, plural, one{{count} специалист} few{{count} специалиста} many{{count} специалистов} other{{count} специалиста}}'**
  String searchOnlineCount(num count);

  /// Вопрос скрининга экстренного сценария (БП-02, шаг 2)
  ///
  /// In ru, this message translates to:
  /// **'Вам угрожает опасность прямо сейчас?'**
  String get emergencyScreeningTitle;

  /// Пояснение под вопросом скрининга
  ///
  /// In ru, this message translates to:
  /// **'Ответьте честно — от этого зависит, чем мы поможем в первую очередь'**
  String get emergencyScreeningBody;

  /// Подпись у выбора формата на экране скрининга — по умолчанию чат
  ///
  /// In ru, this message translates to:
  /// **'Формат подбора можно сменить'**
  String get emergencyScreeningFormatHint;

  /// Утвердительный ответ на вопрос скрининга
  ///
  /// In ru, this message translates to:
  /// **'Да'**
  String get actionYes;

  /// Отрицательный ответ на вопрос скрининга
  ///
  /// In ru, this message translates to:
  /// **'Нет'**
  String get actionNo;

  /// Заголовок экрана угрозы (ответ «Да» на скрининге)
  ///
  /// In ru, this message translates to:
  /// **'Если есть угроза жизни — звоните напрямую'**
  String get emergencyDangerTitle;

  /// Текст экрана угрозы
  ///
  /// In ru, this message translates to:
  /// **'Платформа не заменяет экстренные службы. Позвоните по одному из номеров — это быстрее всего'**
  String get emergencyDangerBody;

  /// Кнопка звонка в полицию на экране угрозы
  ///
  /// In ru, this message translates to:
  /// **'Позвонить 102'**
  String get emergencyCallPolice;

  /// Кнопка звонка в скорую помощь на экране угрозы
  ///
  /// In ru, this message translates to:
  /// **'Позвонить 103'**
  String get emergencyCallAmbulance;

  /// Кнопка внизу экрана угрозы — перейти к приоритетному подбору специалиста
  ///
  /// In ru, this message translates to:
  /// **'Мне не угрожает опасность, продолжить подбор'**
  String get emergencyContinueSearch;

  /// Бейдж экстренного варианта экрана поиска (прототип 16-emergency.png)
  ///
  /// In ru, this message translates to:
  /// **'Приоритетный поиск'**
  String get emergencySearchBadge;

  /// Заголовок экстренного варианта экрана поиска
  ///
  /// In ru, this message translates to:
  /// **'Ищем свободного специалиста для вас'**
  String get emergencySearchTitle;

  /// Пояснение экстренного варианта экрана поиска
  ///
  /// In ru, this message translates to:
  /// **'Мы соединим вас первым в очереди. Если станет тяжело — можно позвонить на 103'**
  String get emergencySearchSubtitle;

  /// Поддерживающая строка экстренного варианта экрана поиска
  ///
  /// In ru, this message translates to:
  /// **'Вы не одни — мы уже подключаем специалиста'**
  String get emergencySearchEncouragement;

  /// Постоянно видимая кнопка вызова экстренных служб на экстренном поиске (требование БП-02)
  ///
  /// In ru, this message translates to:
  /// **'Позвонить 103 / 112'**
  String get emergencyCallServices;

  /// Заголовок экрана эскалации Р-16
  ///
  /// In ru, this message translates to:
  /// **'Мы перезвоним вам'**
  String get hotlinesTitle;

  /// Текст экрана эскалации Р-16: заявку создаёт бэкенд, клиенту ничего отправлять не нужно
  ///
  /// In ru, this message translates to:
  /// **'Заявка на обратный звонок уже оформлена — с вами свяжется первый освободившийся специалист. Пока можно позвонить:'**
  String get hotlinesBody;

  /// Кнопка звонка на конкретный номер горячей линии
  ///
  /// In ru, this message translates to:
  /// **'Позвонить {number}'**
  String hotlineCall(String number);

  /// Название номера 150
  ///
  /// In ru, this message translates to:
  /// **'Телефон доверия'**
  String get hotlineName150;

  /// Название номера 103
  ///
  /// In ru, this message translates to:
  /// **'Скорая помощь'**
  String get hotlineName103;

  /// Название номера 112
  ///
  /// In ru, this message translates to:
  /// **'Единая служба спасения'**
  String get hotlineName112;

  /// Заголовок экрана «специалист найден» (прототип 10-found.png)
  ///
  /// In ru, this message translates to:
  /// **'Специалист найден!'**
  String get foundTitle;

  /// Подпись под именем специалиста на экране «специалист найден» — он доступен прямо сейчас
  ///
  /// In ru, this message translates to:
  /// **'Сейчас на связи'**
  String get foundOnline;

  /// Кнопка перехода к оплате на экране «специалист найден»
  ///
  /// In ru, this message translates to:
  /// **'Начать консультацию'**
  String get foundStart;

  /// Кнопка отказа от найденного специалиста: отменяет консультацию и возвращает на главную
  ///
  /// In ru, this message translates to:
  /// **'Отменить консультацию'**
  String get foundCancel;

  /// Строка со списком языков специалиста
  ///
  /// In ru, this message translates to:
  /// **'Языки: {languages}'**
  String expertLanguages(String languages);

  /// Подпись показателя опыта в карточке специалиста
  ///
  /// In ru, this message translates to:
  /// **'Опыт'**
  String get expertExperienceLabel;

  /// Уровень опыта LESS_THAN_YEAR
  ///
  /// In ru, this message translates to:
  /// **'менее года'**
  String get experienceLessThanYear;

  /// Уровень опыта ONE_TO_THREE
  ///
  /// In ru, this message translates to:
  /// **'1–3 года'**
  String get experienceOneToThree;

  /// Уровень опыта THREE_TO_FIVE
  ///
  /// In ru, this message translates to:
  /// **'3–5 лет'**
  String get experienceThreeToFive;

  /// Уровень опыта FIVE_TO_TEN
  ///
  /// In ru, this message translates to:
  /// **'5–10 лет'**
  String get experienceFiveToTen;

  /// Уровень опыта MORE_THAN_TEN
  ///
  /// In ru, this message translates to:
  /// **'более 10 лет'**
  String get experienceMoreThanTen;

  /// Заголовок шторки оплаты
  ///
  /// In ru, this message translates to:
  /// **'Оплата консультации'**
  String get paymentSheetTitle;

  /// Название позиции в шторке оплаты
  ///
  /// In ru, this message translates to:
  /// **'Консультация'**
  String get paymentLineItem;

  /// Пояснение эскроу-холда в шторке оплаты (Р-01)
  ///
  /// In ru, this message translates to:
  /// **'Деньги замораживаются на карте и списываются только после состоявшейся консультации'**
  String get paymentEscrowNote;

  /// Кнопка оплаты в шторке
  ///
  /// In ru, this message translates to:
  /// **'Оплатить'**
  String get paymentPay;

  /// Кнопка добавления карты — в шторке оплаты и на экране карт
  ///
  /// In ru, this message translates to:
  /// **'Добавить карту'**
  String get paymentAddCard;

  /// Текст в шторке оплаты, когда у клиента нет ни одной карты
  ///
  /// In ru, this message translates to:
  /// **'Пока нет привязанных карт'**
  String get paymentNoCards;

  /// Заголовок состояния PROVIDER_DECLINED в шторке оплаты
  ///
  /// In ru, this message translates to:
  /// **'Платёж отклонён'**
  String get paymentDeclinedTitle;

  /// Кнопка выбора другой карты после отказа платежа
  ///
  /// In ru, this message translates to:
  /// **'Другая карта'**
  String get paymentAnotherCard;

  /// Заголовок экрана привязанных карт
  ///
  /// In ru, this message translates to:
  /// **'Мои карты'**
  String get cardsTitle;

  /// Пустое состояние экрана карт
  ///
  /// In ru, this message translates to:
  /// **'Карт пока нет'**
  String get cardsEmpty;

  /// Заголовок подтверждения удаления карты
  ///
  /// In ru, this message translates to:
  /// **'Открепить карту?'**
  String get cardDeleteTitle;

  /// Текст подтверждения удаления карты
  ///
  /// In ru, this message translates to:
  /// **'Карта {maskedPan} больше не будет доступна для оплаты'**
  String cardDeleteBody(String maskedPan);

  /// Кнопка подтверждения удаления карты
  ///
  /// In ru, this message translates to:
  /// **'Открепить'**
  String get actionDelete;

  /// Кнопка сохранения формы
  ///
  /// In ru, this message translates to:
  /// **'Сохранить'**
  String get actionSave;

  /// Заголовок экрана добавления карты
  ///
  /// In ru, this message translates to:
  /// **'Новая карта'**
  String get addCardTitle;

  /// Подпись поля номера карты
  ///
  /// In ru, this message translates to:
  /// **'Номер карты'**
  String get cardNumberLabel;

  /// Подпись поля срока действия карты
  ///
  /// In ru, this message translates to:
  /// **'Срок действия'**
  String get cardExpiryLabel;

  /// Подпись поля имени держателя карты
  ///
  /// In ru, this message translates to:
  /// **'Имя на карте'**
  String get cardHolderLabel;

  /// Ошибка валидации номера карты (в т.ч. проверка Луна)
  ///
  /// In ru, this message translates to:
  /// **'Проверьте номер карты'**
  String get cardNumberInvalid;

  /// Ошибка валидации срока действия карты
  ///
  /// In ru, this message translates to:
  /// **'Срок действия в формате ММ/ГГ'**
  String get cardExpiryInvalid;

  /// Ошибка валидации имени держателя карты
  ///
  /// In ru, this message translates to:
  /// **'Укажите имя, как на карте'**
  String get cardHolderInvalid;

  /// Длительность консультации в шторке оплаты
  ///
  /// In ru, this message translates to:
  /// **'{minutes, plural, one{{minutes} минута} few{{minutes} минуты} many{{minutes} минут} other{{minutes} минуты}}'**
  String paymentDuration(num minutes);

  /// Число отзывов рядом с рейтингом специалиста
  ///
  /// In ru, this message translates to:
  /// **'{count, plural, one{{count} отзыв} few{{count} отзыва} many{{count} отзывов} other{{count} отзыва}}'**
  String expertReviewsCount(num count);

  /// Плейсхолдер поля ввода сообщения в чате консультации
  ///
  /// In ru, this message translates to:
  /// **'Напишите сообщение...'**
  String get chatInputHint;

  /// Плашка о конфиденциальности над перепиской (прототип 12-chat.png)
  ///
  /// In ru, this message translates to:
  /// **'Здесь безопасно говорить открыто. Все сообщения конфиденциальны'**
  String get chatConfidentialNotice;

  /// Статус сообщения, пока не пришло подтверждение от сервера
  ///
  /// In ru, this message translates to:
  /// **'отправляется'**
  String get chatSending;

  /// Статус сообщения, если сервер отклонил отправку
  ///
  /// In ru, this message translates to:
  /// **'не отправлено'**
  String get chatFailed;

  /// Индикатор набора текста собеседником
  ///
  /// In ru, this message translates to:
  /// **'печатает…'**
  String get chatPeerTyping;

  /// Подпись вместо поля ввода, когда консультация не активна
  ///
  /// In ru, this message translates to:
  /// **'Консультация завершена — писать больше нельзя'**
  String get chatInputDisabled;

  /// Статус специалиста в шапке сессии
  ///
  /// In ru, this message translates to:
  /// **'На связи'**
  String get sessionOnline;

  /// Оставшееся время консультации в шапке сессии
  ///
  /// In ru, this message translates to:
  /// **'Осталось {time}'**
  String sessionRemaining(String time);

  /// Шапка сессии, когда плановое время вышло: сессию это не закрывает — исход фиксирует специалист
  ///
  /// In ru, this message translates to:
  /// **'Время консультации истекло'**
  String get sessionTimeUp;

  /// Заголовок подтверждения отмены консультации (БП-03)
  ///
  /// In ru, this message translates to:
  /// **'Отменить консультацию?'**
  String get sessionCancelTitle;

  /// Текст подтверждения отмены консультации
  ///
  /// In ru, this message translates to:
  /// **'Время освободится для другого пользователя'**
  String get sessionCancelBody;

  /// Пункт меню сессии: отменить консультацию
  ///
  /// In ru, this message translates to:
  /// **'Отменить консультацию'**
  String get sessionMenuCancel;

  /// Заголовок экрана аудиозвонка
  ///
  /// In ru, this message translates to:
  /// **'Аудиоконсультация'**
  String get callAudioTitle;

  /// Заголовок экрана видеозвонка
  ///
  /// In ru, this message translates to:
  /// **'Видеоконсультация'**
  String get callVideoTitle;

  /// Статус экрана звонка: идёт подключение
  ///
  /// In ru, this message translates to:
  /// **'Соединяем…'**
  String get callConnecting;

  /// Статус экрана звонка: соединение установлено
  ///
  /// In ru, this message translates to:
  /// **'На связи'**
  String get callConnected;

  /// Баннер экрана звонка при переподключении (формулировка прототипа)
  ///
  /// In ru, this message translates to:
  /// **'Связь восстанавливается, собеседник останется на линии'**
  String get callReconnecting;

  /// Заголовок состояния, когда переподключение не удалось за 30 секунд
  ///
  /// In ru, this message translates to:
  /// **'Связь не восстановилась'**
  String get callFailedTitle;

  /// Кнопка деградации звонка в переписку (ТЗ §6)
  ///
  /// In ru, this message translates to:
  /// **'Продолжить в чате'**
  String get callContinueInChat;

  /// Кнопка завершения звонка — кладёт трубку, исход фиксирует специалист
  ///
  /// In ru, this message translates to:
  /// **'Завершить'**
  String get callEnd;

  /// Подпись кнопки микрофона на экране звонка
  ///
  /// In ru, this message translates to:
  /// **'Микрофон'**
  String get callMic;

  /// Подпись кнопки камеры на экране звонка
  ///
  /// In ru, this message translates to:
  /// **'Камера'**
  String get callCamera;

  /// Пояснение, когда пользователь отказал в доступе к камере
  ///
  /// In ru, this message translates to:
  /// **'Камера недоступна — идёт аудиоразговор'**
  String get callCameraBlocked;

  /// Заголовок экрана-объяснения при отказе в разрешении микрофона
  ///
  /// In ru, this message translates to:
  /// **'Нужен доступ к микрофону'**
  String get callPermissionTitle;

  /// Текст экрана-объяснения при отказе в разрешении
  ///
  /// In ru, this message translates to:
  /// **'Без микрофона аудио- или видеоконсультацию провести нельзя. Разрешение можно выдать в настройках приложения'**
  String get callPermissionBody;

  /// Кнопка перехода в системные настройки приложения
  ///
  /// In ru, this message translates to:
  /// **'Открыть настройки'**
  String get callOpenSettings;

  /// Пункт меню сессии: эскалация в аудиозвонок
  ///
  /// In ru, this message translates to:
  /// **'Перейти в аудио'**
  String get sessionMenuAudio;

  /// Пункт меню сессии: эскалация в видеозвонок
  ///
  /// In ru, this message translates to:
  /// **'Перейти в видео'**
  String get sessionMenuVideo;

  /// Заголовок экрана оценки консультации (прототип 15-rating.png)
  ///
  /// In ru, this message translates to:
  /// **'Спасибо, что доверяете SmartQoldau'**
  String get reviewTitle;

  /// Вопрос над звёздами на экране оценки
  ///
  /// In ru, this message translates to:
  /// **'Как прошла консультация?'**
  String get reviewRatingQuestion;

  /// Подпись поля публичного отзыва
  ///
  /// In ru, this message translates to:
  /// **'Публичный отзыв'**
  String get reviewPublicLabel;

  /// Пояснение к полю публичного отзыва: он анонимный
  ///
  /// In ru, this message translates to:
  /// **'Виден другим клиентам, без вашего имени'**
  String get reviewPublicHint;

  /// Подпись поля приватного отзыва
  ///
  /// In ru, this message translates to:
  /// **'Приватно команде качества'**
  String get reviewPrivateLabel;

  /// Пояснение к приватному полю (формулировка прототипа)
  ///
  /// In ru, this message translates to:
  /// **'Отзыв видит только команда качества SmartQoldau — психолог его не увидит'**
  String get reviewPrivateHint;

  /// Кнопка отправки отзыва (формулировка прототипа)
  ///
  /// In ru, this message translates to:
  /// **'Завершить'**
  String get reviewSend;

  /// Кнопка отказа от оценки
  ///
  /// In ru, this message translates to:
  /// **'Пропустить'**
  String get reviewSkip;

  /// Кнопка создания новой заявки к тому же специалисту
  ///
  /// In ru, this message translates to:
  /// **'Продолжить с тем же психологом'**
  String get reviewContinueSameExpert;

  /// Экран при ответе REVIEW_EXISTS
  ///
  /// In ru, this message translates to:
  /// **'Вы уже оценили эту консультацию'**
  String get reviewExistsTitle;

  /// Подпись под одной звездой
  ///
  /// In ru, this message translates to:
  /// **'Плохо'**
  String get reviewRating1;

  /// Подпись под двумя звёздами
  ///
  /// In ru, this message translates to:
  /// **'Так себе'**
  String get reviewRating2;

  /// Подпись под тремя звёздами
  ///
  /// In ru, this message translates to:
  /// **'Нормально'**
  String get reviewRating3;

  /// Подпись под четырьмя звёздами
  ///
  /// In ru, this message translates to:
  /// **'Хорошо'**
  String get reviewRating4;

  /// Подпись под пятью звёздами
  ///
  /// In ru, this message translates to:
  /// **'Отлично'**
  String get reviewRating5;

  /// Заголовок экрана каталога
  ///
  /// In ru, this message translates to:
  /// **'Специалисты'**
  String get catalogTitle;

  /// Кнопка открытия шторки фильтров каталога
  ///
  /// In ru, this message translates to:
  /// **'Фильтры'**
  String get catalogFilters;

  /// Пустой каталог
  ///
  /// In ru, this message translates to:
  /// **'По этим фильтрам никого не нашлось'**
  String get catalogEmpty;

  /// Кнопка сброса фильтров каталога
  ///
  /// In ru, this message translates to:
  /// **'Сбросить фильтры'**
  String get catalogResetFilters;

  /// Подпись фильтра по теме
  ///
  /// In ru, this message translates to:
  /// **'Тема'**
  String get filterTopic;

  /// Подпись фильтра по языку
  ///
  /// In ru, this message translates to:
  /// **'Язык'**
  String get filterLanguage;

  /// Подпись фильтра по формату
  ///
  /// In ru, this message translates to:
  /// **'Формат'**
  String get filterFormat;

  /// Подпись выбора сортировки
  ///
  /// In ru, this message translates to:
  /// **'Сортировка'**
  String get filterSort;

  /// Значение фильтра «без ограничения»
  ///
  /// In ru, this message translates to:
  /// **'Любой'**
  String get filterAny;

  /// Сортировка каталога по возрастанию цены
  ///
  /// In ru, this message translates to:
  /// **'Сначала дешевле'**
  String get sortPriceAsc;

  /// Сортировка каталога по убыванию цены
  ///
  /// In ru, this message translates to:
  /// **'Сначала дороже'**
  String get sortPriceDesc;

  /// Сортировка каталога по рейтингу
  ///
  /// In ru, this message translates to:
  /// **'По рейтингу'**
  String get sortRating;

  /// Кнопка применения фильтров
  ///
  /// In ru, this message translates to:
  /// **'Применить'**
  String get actionApply;

  /// Заголовок экрана избранных специалистов
  ///
  /// In ru, this message translates to:
  /// **'Избранное'**
  String get favoritesTitle;

  /// Пустое избранное
  ///
  /// In ru, this message translates to:
  /// **'Пока никого не добавили'**
  String get favoritesEmpty;

  /// Заголовок блока тем в профиле специалиста
  ///
  /// In ru, this message translates to:
  /// **'Темы'**
  String get expertTopicsTitle;

  /// Заголовок ленты отзывов в профиле специалиста
  ///
  /// In ru, this message translates to:
  /// **'Отзывы'**
  String get expertReviewsTitle;

  /// Пустая лента отзывов
  ///
  /// In ru, this message translates to:
  /// **'Отзывов пока нет'**
  String get expertNoReviews;

  /// Подпись ответа специалиста на отзыв
  ///
  /// In ru, this message translates to:
  /// **'Ответ специалиста'**
  String get expertReplyPrefix;

  /// Подпись цены в профиле специалиста
  ///
  /// In ru, this message translates to:
  /// **'Консультация'**
  String get expertPriceLabel;

  /// Заголовок диалога при EXPERT_UNAVAILABLE
  ///
  /// In ru, this message translates to:
  /// **'Специалист сейчас недоступен'**
  String get expertUnavailableTitle;

  /// Текст диалога при EXPERT_UNAVAILABLE
  ///
  /// In ru, this message translates to:
  /// **'Можно подобрать другого свободного специалиста по этой же теме'**
  String get expertUnavailableBody;

  /// Кнопка автоподбора вместо недоступного специалиста
  ///
  /// In ru, this message translates to:
  /// **'Подобрать автоматически'**
  String get expertPickAutomatically;

  /// Кнопка догрузки ленты отзывов
  ///
  /// In ru, this message translates to:
  /// **'Показать ещё отзывы'**
  String get expertLoadMoreReviews;

  /// Вкладка активных консультаций
  ///
  /// In ru, this message translates to:
  /// **'Активные'**
  String get consultationsActiveTab;

  /// Вкладка истории консультаций
  ///
  /// In ru, this message translates to:
  /// **'История'**
  String get consultationsHistoryTab;

  /// Пустая вкладка активных консультаций
  ///
  /// In ru, this message translates to:
  /// **'Активных консультаций нет'**
  String get consultationsEmptyActive;

  /// Пустая вкладка истории консультаций
  ///
  /// In ru, this message translates to:
  /// **'История пока пуста'**
  String get consultationsEmptyHistory;

  /// Кнопка возврата в активную консультацию
  ///
  /// In ru, this message translates to:
  /// **'Продолжить'**
  String get consultationContinue;

  /// Кнопка отмены активной консультации
  ///
  /// In ru, this message translates to:
  /// **'Отменить'**
  String get consultationCancel;

  /// Кнопка повторной записи к тому же специалисту
  ///
  /// In ru, this message translates to:
  /// **'Повторить запись'**
  String get consultationRepeat;

  /// Заголовок экрана деталей консультации
  ///
  /// In ru, this message translates to:
  /// **'Консультация'**
  String get consultationDetailsTitle;

  /// Кнопка догрузки списка консультаций
  ///
  /// In ru, this message translates to:
  /// **'Показать ещё'**
  String get consultationLoadMore;

  /// Платёжный статус HELD
  ///
  /// In ru, this message translates to:
  /// **'Деньги заморожены'**
  String get paymentStatusHeld;

  /// Платёжный статус CAPTURED
  ///
  /// In ru, this message translates to:
  /// **'Оплачено'**
  String get paymentStatusCaptured;

  /// Платёжный статус VOIDED
  ///
  /// In ru, this message translates to:
  /// **'Возвращено'**
  String get paymentStatusVoided;

  /// Платёжный статус FAILED
  ///
  /// In ru, this message translates to:
  /// **'Оплата не прошла'**
  String get paymentStatusFailed;

  /// Платёжный статус UNPAID
  ///
  /// In ru, this message translates to:
  /// **'Ожидает оплаты'**
  String get paymentStatusUnpaid;

  /// Строка с маской карты в деталях консультации
  ///
  /// In ru, this message translates to:
  /// **'Оплачено картой {maskedPan}'**
  String paymentPaidWithCard(String maskedPan);

  /// Статус консультации ACTIVE
  ///
  /// In ru, this message translates to:
  /// **'Идёт'**
  String get consultationStatusActive;

  /// Статус консультации COMPLETED
  ///
  /// In ru, this message translates to:
  /// **'Завершена'**
  String get consultationStatusCompleted;

  /// Статус консультации CANCELLED
  ///
  /// In ru, this message translates to:
  /// **'Отменена'**
  String get consultationStatusCancelled;

  /// Исход COMPLETED
  ///
  /// In ru, this message translates to:
  /// **'Состоялась'**
  String get outcomeCompleted;

  /// Исход CLIENT_NO_SHOW
  ///
  /// In ru, this message translates to:
  /// **'Вы не подключились'**
  String get outcomeClientNoShow;

  /// Исход CLIENT_CANCELLED
  ///
  /// In ru, this message translates to:
  /// **'Отменена вами'**
  String get outcomeClientCancelled;

  /// Исход TECH_ISSUE
  ///
  /// In ru, this message translates to:
  /// **'Технический сбой'**
  String get outcomeTechIssue;

  /// Заголовок блока собственного отзыва в деталях консультации
  ///
  /// In ru, this message translates to:
  /// **'Ваш отзыв'**
  String get myReviewTitle;

  /// Заголовок подтверждения удаления отзыва
  ///
  /// In ru, this message translates to:
  /// **'Удалить отзыв?'**
  String get reviewDeleteTitle;

  /// Текст подтверждения удаления отзыва (ТЗ §5.7)
  ///
  /// In ru, this message translates to:
  /// **'Рейтинг специалиста будет пересчитан'**
  String get reviewDeleteBody;

  /// Кнопка удаления своего отзыва
  ///
  /// In ru, this message translates to:
  /// **'Удалить отзыв'**
  String get reviewDelete;

  /// Кнопка перехода к уже идущей консультации из диалога ACTIVE_REQUEST_EXISTS
  ///
  /// In ru, this message translates to:
  /// **'Перейти к консультации'**
  String get funnelActiveRequestGoTo;

  /// Заголовок центра уведомлений
  ///
  /// In ru, this message translates to:
  /// **'Уведомления'**
  String get notificationsTitle;

  /// Пустой центр уведомлений
  ///
  /// In ru, this message translates to:
  /// **'Уведомлений пока нет'**
  String get notificationsEmpty;

  /// Кнопка «отметить все прочитанными»
  ///
  /// In ru, this message translates to:
  /// **'Прочитать все'**
  String get notificationsMarkAllRead;

  /// Заголовок гостевого блока в профиле
  ///
  /// In ru, this message translates to:
  /// **'Создайте аккаунт'**
  String get profileGuestTitle;

  /// Объяснение выгоды регистрации гостю (Р-22)
  ///
  /// In ru, this message translates to:
  /// **'Активная консультация и привязанная карта сохранятся, а доступ к истории останется при смене устройства'**
  String get profileGuestBody;

  /// Кнопка перехода к конверсии гостя
  ///
  /// In ru, this message translates to:
  /// **'Создать аккаунт'**
  String get profileCreateAccount;

  /// Строка со счётчиком завершённых консультаций в профиле
  ///
  /// In ru, this message translates to:
  /// **'Завершённых консультаций: {count}'**
  String profileCompletedConsultations(num count);

  /// Пункт профиля: карты
  ///
  /// In ru, this message translates to:
  /// **'Способы оплаты'**
  String get profilePaymentMethods;

  /// Пункт профиля: центр уведомлений
  ///
  /// In ru, this message translates to:
  /// **'Уведомления'**
  String get profileNotifications;

  /// Пункт профиля: язык интерфейса
  ///
  /// In ru, this message translates to:
  /// **'Язык'**
  String get profileLanguage;

  /// Пункт профиля: обращения в поддержку
  ///
  /// In ru, this message translates to:
  /// **'Поддержка'**
  String get profileSupport;

  /// Пункт профиля: соглашение
  ///
  /// In ru, this message translates to:
  /// **'Пользовательское соглашение'**
  String get profileTerms;

  /// Пункт профиля: политика
  ///
  /// In ru, this message translates to:
  /// **'Политика конфиденциальности'**
  String get profilePrivacy;

  /// Пункт профиля: удаление аккаунта через обращение
  ///
  /// In ru, this message translates to:
  /// **'Удалить аккаунт'**
  String get profileDeleteAccount;

  /// Пункт профиля: выход из аккаунта
  ///
  /// In ru, this message translates to:
  /// **'Выйти'**
  String get profileLogout;

  /// Заголовок подтверждения выхода
  ///
  /// In ru, this message translates to:
  /// **'Выйти из аккаунта?'**
  String get profileLogoutTitle;

  /// Текст подтверждения выхода для зарегистрированного
  ///
  /// In ru, this message translates to:
  /// **'Вы сможете войти снова по номеру телефона'**
  String get profileLogoutBody;

  /// Текст подтверждения выхода для гостя (Р-22)
  ///
  /// In ru, this message translates to:
  /// **'Это гостевая сессия: после выхода её данные будут потеряны безвозвратно — история консультаций и привязанная карта не восстановятся'**
  String get profileLogoutGuestBody;

  /// Заголовок подтверждения удаления аккаунта
  ///
  /// In ru, this message translates to:
  /// **'Удалить аккаунт и данные?'**
  String get profileDeleteAccountTitle;

  /// Текст подтверждения удаления аккаунта: прямого эндпоинта удаления нет
  ///
  /// In ru, this message translates to:
  /// **'Мы создадим обращение в поддержку — команда свяжется с вами и подтвердит удаление'**
  String get profileDeleteAccountBody;

  /// Тема автоматически созданного обращения на удаление аккаунта
  ///
  /// In ru, this message translates to:
  /// **'Удаление аккаунта и данных'**
  String get profileDeleteAccountSubject;

  /// Тело автоматически созданного обращения на удаление аккаунта
  ///
  /// In ru, this message translates to:
  /// **'Прошу удалить мой аккаунт и связанные с ним данные'**
  String get profileDeleteAccountTicketBody;

  /// Заголовок экрана конверсии гостя
  ///
  /// In ru, this message translates to:
  /// **'Создание аккаунта'**
  String get convertGuestTitle;

  /// Объяснение при PHONE_ALREADY_REGISTERED на конверсии
  ///
  /// In ru, this message translates to:
  /// **'Этот номер уже зарегистрирован. Войти в тот аккаунт можно на экране входа, но данные гостевой сессии в него не перенесутся'**
  String get convertGuestPhoneAlreadyUsed;

  /// Заголовок экрана обращений
  ///
  /// In ru, this message translates to:
  /// **'Поддержка'**
  String get supportTitle;

  /// Пустой список обращений
  ///
  /// In ru, this message translates to:
  /// **'Обращений пока нет'**
  String get supportEmpty;

  /// Кнопка создания обращения
  ///
  /// In ru, this message translates to:
  /// **'Новое обращение'**
  String get supportNewTicket;

  /// Пояснение в карточке обращения: бэкенд не даёт автору отвечать в тред
  ///
  /// In ru, this message translates to:
  /// **'Дописать в это обращение нельзя — если нужно добавить детали, создайте новое'**
  String get supportNoReplyNotice;

  /// Поле темы обращения
  ///
  /// In ru, this message translates to:
  /// **'Тема'**
  String get ticketSubjectLabel;

  /// Поле текста обращения
  ///
  /// In ru, this message translates to:
  /// **'Опишите ситуацию'**
  String get ticketBodyLabel;

  /// Выбор категории обращения
  ///
  /// In ru, this message translates to:
  /// **'Категория'**
  String get ticketCategoryLabel;

  /// Ошибка валидации темы
  ///
  /// In ru, this message translates to:
  /// **'Укажите тему обращения'**
  String get ticketSubjectInvalid;

  /// Ошибка валидации текста
  ///
  /// In ru, this message translates to:
  /// **'Опишите ситуацию подробнее'**
  String get ticketBodyInvalid;

  /// Автор сообщения обращения: клиент
  ///
  /// In ru, this message translates to:
  /// **'Вы'**
  String get ticketAuthorYou;

  /// Автор сообщения обращения: сотрудник
  ///
  /// In ru, this message translates to:
  /// **'Поддержка'**
  String get ticketAuthorStaff;

  /// Статус обращения NEW
  ///
  /// In ru, this message translates to:
  /// **'Новое'**
  String get ticketStatusNew;

  /// Статус обращения IN_PROGRESS
  ///
  /// In ru, this message translates to:
  /// **'В работе'**
  String get ticketStatusInProgress;

  /// Статус обращения RESOLVED
  ///
  /// In ru, this message translates to:
  /// **'Решено'**
  String get ticketStatusResolved;

  /// Категория обращения CONSULTATIONS
  ///
  /// In ru, this message translates to:
  /// **'Консультации'**
  String get ticketCategoryConsultations;

  /// Категория обращения PAYMENT
  ///
  /// In ru, this message translates to:
  /// **'Оплата'**
  String get ticketCategoryPayment;

  /// Категория обращения TECHNICAL
  ///
  /// In ru, this message translates to:
  /// **'Технические проблемы'**
  String get ticketCategoryTechnical;

  /// Категория обращения ACCOUNT_DATA
  ///
  /// In ru, this message translates to:
  /// **'Аккаунт и данные'**
  String get ticketCategoryAccountData;

  /// Категория обращения SECURITY
  ///
  /// In ru, this message translates to:
  /// **'Безопасность'**
  String get ticketCategorySecurity;

  /// Категория обращения OTHER
  ///
  /// In ru, this message translates to:
  /// **'Другое'**
  String get ticketCategoryOther;

  /// Кнопка отправки формы (обращение в поддержку)
  ///
  /// In ru, this message translates to:
  /// **'Отправить'**
  String get actionSend;

  /// Пункт меню сессии: создать обращение в поддержку по этой консультации
  ///
  /// In ru, this message translates to:
  /// **'Сообщить о проблеме'**
  String get sessionMenuReport;

  /// Язык консультации: английский
  ///
  /// In ru, this message translates to:
  /// **'Английский'**
  String get languageEnglish;

  /// Тег отзыва «Не помогло» (код not_helpful)
  ///
  /// In ru, this message translates to:
  /// **'Не помогло'**
  String get reviewTagNotHelpful;

  /// Тег отзыва «Долгое ожидание» (код long_wait)
  ///
  /// In ru, this message translates to:
  /// **'Долгое ожидание'**
  String get reviewTagLongWait;

  /// Тег отзыва «Плохая связь» (код bad_connection)
  ///
  /// In ru, this message translates to:
  /// **'Плохая связь'**
  String get reviewTagBadConnection;

  /// Тег отзыва «Мало пользы» (код little_use)
  ///
  /// In ru, this message translates to:
  /// **'Мало пользы'**
  String get reviewTagLittleUse;

  /// Тег отзыва «Не понял меня» (код did_not_understand)
  ///
  /// In ru, this message translates to:
  /// **'Не понял меня'**
  String get reviewTagDidNotUnderstand;

  /// Тег отзыва «Технические проблемы» (код technical_issues)
  ///
  /// In ru, this message translates to:
  /// **'Технические проблемы'**
  String get reviewTagTechnicalIssues;

  /// Тег отзыва «Средне» (код average)
  ///
  /// In ru, this message translates to:
  /// **'Средне'**
  String get reviewTagAverage;

  /// Тег отзыва «Могло быть лучше» (код could_be_better)
  ///
  /// In ru, this message translates to:
  /// **'Могло быть лучше'**
  String get reviewTagCouldBeBetter;

  /// Тег отзыва «Стандартно» (код standard)
  ///
  /// In ru, this message translates to:
  /// **'Стандартно'**
  String get reviewTagStandard;

  /// Тег отзыва «Внимательный» (код attentive)
  ///
  /// In ru, this message translates to:
  /// **'Внимательный'**
  String get reviewTagAttentive;

  /// Тег отзыва «Помог разобраться» (код helped_figure_out)
  ///
  /// In ru, this message translates to:
  /// **'Помог разобраться'**
  String get reviewTagHelpedFigureOut;

  /// Тег отзыва «Профессионально» (код professional)
  ///
  /// In ru, this message translates to:
  /// **'Профессионально'**
  String get reviewTagProfessional;

  /// Тег отзыва «Превзошёл ожидания» (код exceeded_expectations)
  ///
  /// In ru, this message translates to:
  /// **'Превзошёл ожидания'**
  String get reviewTagExceededExpectations;

  /// Подпись над тегами оценки
  ///
  /// In ru, this message translates to:
  /// **'Что было важно?'**
  String get reviewTagsHint;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Выбор времени'**
  String get bookingTitle;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Время указано по Алматы'**
  String get bookingTimezoneNote;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'В этот день свободного времени нет'**
  String get bookingNoSlotsDay;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Выберите карту'**
  String get bookingChooseCard;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Записаться'**
  String get bookingConfirm;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Это время только что заняли'**
  String get bookingSlotTaken;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Перенос консультации'**
  String get rescheduleTitle;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Перенести'**
  String get rescheduleConfirm;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Запланирована'**
  String get consultationScheduled;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Отмена менее чем за 2 часа учитывается в счётчике отмен. Три отмены за 30 дней отключают автоподбор.'**
  String get consultationCancelLateWarning;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Через {duration}'**
  String consultationStartsIn(String duration);

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Записаться на время'**
  String get bookingActionSchedule;

  /// Плановые консультации (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Связаться сейчас'**
  String get bookingActionNow;

  /// Исход: отмена специалистом (E6b)
  ///
  /// In ru, this message translates to:
  /// **'Отменена специалистом'**
  String get outcomeExpertCancelled;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['kk', 'ru'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'kk':
      return AppLocalizationsKk();
    case 'ru':
      return AppLocalizationsRu();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
