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

  /// Кнопка возврата на предыдущий экран
  ///
  /// In ru, this message translates to:
  /// **'Назад'**
  String get actionBack;

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

  /// Пояснение под заголовком экрана-заглушки ещё не реализованного раздела (Каталог/Консультации/Профиль/экстренный сценарий/тема/сессия) — явно сообщает, что раздел не готов, а не имитирует легитимно пустой список
  ///
  /// In ru, this message translates to:
  /// **'Раздел находится в разработке'**
  String get stubSectionSubtitle;

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
