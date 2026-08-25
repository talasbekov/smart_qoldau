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

  /// Заголовок приложения (MaterialApp.onGenerateTitle).
  ///
  /// In ru, this message translates to:
  /// **'SmartQoldau Эксперт'**
  String get appTitle;

  /// Экран заставки: подпись под заголовком, пока идёт restore() сессии.
  ///
  /// In ru, this message translates to:
  /// **'Загружаем ваш кабинет…'**
  String get splashLoading;

  /// Заголовок AppBar экрана входа по телефону.
  ///
  /// In ru, this message translates to:
  /// **'Вход для специалиста'**
  String get phoneScreenTitle;

  /// Подсказка над полем ввода телефона.
  ///
  /// In ru, this message translates to:
  /// **'Введите номер телефона — на него придёт код подтверждения'**
  String get phoneScreenHint;

  /// labelText поля ввода телефона.
  ///
  /// In ru, this message translates to:
  /// **'Номер телефона'**
  String get phoneNumberLabel;

  /// Кнопка отправки SMS-кода.
  ///
  /// In ru, this message translates to:
  /// **'Получить код'**
  String get actionGetCode;

  /// Заголовок AppBar экрана ввода SMS-кода.
  ///
  /// In ru, this message translates to:
  /// **'Код подтверждения'**
  String get codeScreenTitle;

  /// Подпись над ячейками ввода кода — номер, на который отправлен код.
  ///
  /// In ru, this message translates to:
  /// **'Мы отправили код на {phone}'**
  String codeScreenSentTo(String phone);

  /// Кнопка повторной отправки SMS-кода (активна после отсчёта).
  ///
  /// In ru, this message translates to:
  /// **'Отправить код повторно'**
  String get actionResendCode;

  /// Текст кнопки повторной отправки во время обратного отсчёта.
  ///
  /// In ru, this message translates to:
  /// **'Повторно через {seconds} с'**
  String resendCodeCountdown(int seconds);

  /// No description provided for @actionRetry.
  ///
  /// In ru, this message translates to:
  /// **'Повторить'**
  String get actionRetry;

  /// No description provided for @actionNext.
  ///
  /// In ru, this message translates to:
  /// **'Далее'**
  String get actionNext;

  /// No description provided for @actionSubmitProfile.
  ///
  /// In ru, this message translates to:
  /// **'Отправить анкету'**
  String get actionSubmitProfile;

  /// No description provided for @errorLoadFailed.
  ///
  /// In ru, this message translates to:
  /// **'Не удалось загрузить данные'**
  String get errorLoadFailed;

  /// No description provided for @onboardingProfileTitle.
  ///
  /// In ru, this message translates to:
  /// **'Анкета специалиста — шаг 1 из 2'**
  String get onboardingProfileTitle;

  /// No description provided for @fieldFullName.
  ///
  /// In ru, this message translates to:
  /// **'Имя и фамилия'**
  String get fieldFullName;

  /// No description provided for @fieldCity.
  ///
  /// In ru, this message translates to:
  /// **'Город'**
  String get fieldCity;

  /// No description provided for @fieldExperience.
  ///
  /// In ru, this message translates to:
  /// **'Опыт работы'**
  String get fieldExperience;

  /// No description provided for @fieldEducation.
  ///
  /// In ru, this message translates to:
  /// **'Образование'**
  String get fieldEducation;

  /// No description provided for @fieldPriceTenge.
  ///
  /// In ru, this message translates to:
  /// **'Стоимость консультации, ₸'**
  String get fieldPriceTenge;

  /// No description provided for @fieldLanguages.
  ///
  /// In ru, this message translates to:
  /// **'Языки консультации'**
  String get fieldLanguages;

  /// No description provided for @fieldFormats.
  ///
  /// In ru, this message translates to:
  /// **'Форматы консультаций'**
  String get fieldFormats;

  /// No description provided for @languageRussian.
  ///
  /// In ru, this message translates to:
  /// **'Русский'**
  String get languageRussian;

  /// No description provided for @languageKazakh.
  ///
  /// In ru, this message translates to:
  /// **'Казахский'**
  String get languageKazakh;

  /// No description provided for @languageEnglish.
  ///
  /// In ru, this message translates to:
  /// **'Английский'**
  String get languageEnglish;

  /// No description provided for @experienceLessThanYear.
  ///
  /// In ru, this message translates to:
  /// **'Менее 1 года'**
  String get experienceLessThanYear;

  /// No description provided for @experienceOneToThree.
  ///
  /// In ru, this message translates to:
  /// **'1–3 года'**
  String get experienceOneToThree;

  /// No description provided for @experienceThreeToFive.
  ///
  /// In ru, this message translates to:
  /// **'3–5 лет'**
  String get experienceThreeToFive;

  /// No description provided for @experienceFiveToTen.
  ///
  /// In ru, this message translates to:
  /// **'5–10 лет'**
  String get experienceFiveToTen;

  /// No description provided for @experienceMoreThanTen.
  ///
  /// In ru, this message translates to:
  /// **'Более 10 лет'**
  String get experienceMoreThanTen;

  /// No description provided for @formatChat.
  ///
  /// In ru, this message translates to:
  /// **'Чат'**
  String get formatChat;

  /// No description provided for @formatAudio.
  ///
  /// In ru, this message translates to:
  /// **'Аудио'**
  String get formatAudio;

  /// No description provided for @formatVideo.
  ///
  /// In ru, this message translates to:
  /// **'Видео'**
  String get formatVideo;

  /// No description provided for @onboardingTopicsTitle.
  ///
  /// In ru, this message translates to:
  /// **'Анкета специалиста — шаг 2 из 2'**
  String get onboardingTopicsTitle;

  /// No description provided for @onboardingTopicsHint.
  ///
  /// In ru, this message translates to:
  /// **'Выберите темы консультаций, с которыми вы работаете'**
  String get onboardingTopicsHint;

  /// No description provided for @documentsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Документы верификации'**
  String get documentsScreenTitle;

  /// No description provided for @documentTypeIdentity.
  ///
  /// In ru, this message translates to:
  /// **'Удостоверение личности'**
  String get documentTypeIdentity;

  /// No description provided for @documentTypeDiploma.
  ///
  /// In ru, this message translates to:
  /// **'Диплом об образовании'**
  String get documentTypeDiploma;

  /// No description provided for @documentTypeCertificates.
  ///
  /// In ru, this message translates to:
  /// **'Сертификаты'**
  String get documentTypeCertificates;

  /// No description provided for @documentTypeQualification.
  ///
  /// In ru, this message translates to:
  /// **'Подтверждение квалификации'**
  String get documentTypeQualification;

  /// No description provided for @documentStatusNotUploaded.
  ///
  /// In ru, this message translates to:
  /// **'Не загружен'**
  String get documentStatusNotUploaded;

  /// No description provided for @documentStatusUploaded.
  ///
  /// In ru, this message translates to:
  /// **'На проверке'**
  String get documentStatusUploaded;

  /// No description provided for @documentStatusApproved.
  ///
  /// In ru, this message translates to:
  /// **'Принят'**
  String get documentStatusApproved;

  /// No description provided for @documentStatusReuploadRequired.
  ///
  /// In ru, this message translates to:
  /// **'Нужна переотправка'**
  String get documentStatusReuploadRequired;

  /// No description provided for @documentTooLarge.
  ///
  /// In ru, this message translates to:
  /// **'Файл больше 10 МБ — выберите файл меньшего размера'**
  String get documentTooLarge;

  /// No description provided for @actionSubmitForReview.
  ///
  /// In ru, this message translates to:
  /// **'Отправить на проверку'**
  String get actionSubmitForReview;

  /// No description provided for @actionUpload.
  ///
  /// In ru, this message translates to:
  /// **'Загрузить'**
  String get actionUpload;

  /// No description provided for @actionReplace.
  ///
  /// In ru, this message translates to:
  /// **'Заменить'**
  String get actionReplace;

  /// No description provided for @photoScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Фото профиля'**
  String get photoScreenTitle;

  /// No description provided for @actionUploadPhoto.
  ///
  /// In ru, this message translates to:
  /// **'Загрузить фото'**
  String get actionUploadPhoto;

  /// No description provided for @actionDeletePhoto.
  ///
  /// In ru, this message translates to:
  /// **'Удалить фото'**
  String get actionDeletePhoto;

  /// No description provided for @photoStatusNone.
  ///
  /// In ru, this message translates to:
  /// **'Фото не загружено'**
  String get photoStatusNone;

  /// No description provided for @photoStatusPending.
  ///
  /// In ru, this message translates to:
  /// **'Фото отправлено на проверку'**
  String get photoStatusPending;

  /// No description provided for @photoStatusApproved.
  ///
  /// In ru, this message translates to:
  /// **'Фото одобрено'**
  String get photoStatusApproved;

  /// No description provided for @photoStatusRejected.
  ///
  /// In ru, this message translates to:
  /// **'Фото отклонено'**
  String get photoStatusRejected;

  /// No description provided for @verificationScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Статус верификации'**
  String get verificationScreenTitle;

  /// No description provided for @verificationDraft.
  ///
  /// In ru, this message translates to:
  /// **'Анкета не отправлена'**
  String get verificationDraft;

  /// No description provided for @verificationPending.
  ///
  /// In ru, this message translates to:
  /// **'Анкета на проверке. Срок рассмотрения — до 24 часов'**
  String get verificationPending;

  /// No description provided for @verificationVerified.
  ///
  /// In ru, this message translates to:
  /// **'Верификация пройдена'**
  String get verificationVerified;

  /// No description provided for @fieldPhoto.
  ///
  /// In ru, this message translates to:
  /// **'Фото'**
  String get fieldPhoto;

  /// No description provided for @fieldAbout.
  ///
  /// In ru, this message translates to:
  /// **'О себе'**
  String get fieldAbout;

  /// No description provided for @fieldStatusNone.
  ///
  /// In ru, this message translates to:
  /// **'{field}: не заполнено'**
  String fieldStatusNone(String field);

  /// No description provided for @fieldStatusPending.
  ///
  /// In ru, this message translates to:
  /// **'{field}: на проверке'**
  String fieldStatusPending(String field);

  /// No description provided for @fieldStatusApproved.
  ///
  /// In ru, this message translates to:
  /// **'{field}: одобрено'**
  String fieldStatusApproved(String field);

  /// No description provided for @fieldStatusRejected.
  ///
  /// In ru, this message translates to:
  /// **'{field}: отклонено'**
  String fieldStatusRejected(String field);

  /// No description provided for @actionReupload.
  ///
  /// In ru, this message translates to:
  /// **'Загрузить заново'**
  String get actionReupload;

  /// No description provided for @weekdayMon.
  ///
  /// In ru, this message translates to:
  /// **'Пн'**
  String get weekdayMon;

  /// No description provided for @weekdayTue.
  ///
  /// In ru, this message translates to:
  /// **'Вт'**
  String get weekdayTue;

  /// No description provided for @weekdayWed.
  ///
  /// In ru, this message translates to:
  /// **'Ср'**
  String get weekdayWed;

  /// No description provided for @weekdayThu.
  ///
  /// In ru, this message translates to:
  /// **'Чт'**
  String get weekdayThu;

  /// No description provided for @weekdayFri.
  ///
  /// In ru, this message translates to:
  /// **'Пт'**
  String get weekdayFri;

  /// No description provided for @weekdaySat.
  ///
  /// In ru, this message translates to:
  /// **'Сб'**
  String get weekdaySat;

  /// No description provided for @weekdaySun.
  ///
  /// In ru, this message translates to:
  /// **'Вс'**
  String get weekdaySun;

  /// No description provided for @scheduleScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Расписание'**
  String get scheduleScreenTitle;

  /// No description provided for @scheduleStart.
  ///
  /// In ru, this message translates to:
  /// **'Начало'**
  String get scheduleStart;

  /// No description provided for @scheduleEnd.
  ///
  /// In ru, this message translates to:
  /// **'Конец'**
  String get scheduleEnd;

  /// No description provided for @scheduleBreakStart.
  ///
  /// In ru, this message translates to:
  /// **'Перерыв с'**
  String get scheduleBreakStart;

  /// No description provided for @scheduleBreakEnd.
  ///
  /// In ru, this message translates to:
  /// **'Перерыв до'**
  String get scheduleBreakEnd;

  /// No description provided for @actionClearBreak.
  ///
  /// In ru, this message translates to:
  /// **'Убрать перерыв'**
  String get actionClearBreak;

  /// No description provided for @actionSave.
  ///
  /// In ru, this message translates to:
  /// **'Сохранить'**
  String get actionSave;

  /// No description provided for @exceptionsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Исключения в расписании'**
  String get exceptionsScreenTitle;

  /// No description provided for @scheduleDayOff.
  ///
  /// In ru, this message translates to:
  /// **'Выходной'**
  String get scheduleDayOff;

  /// No description provided for @actionMakeDayOff.
  ///
  /// In ru, this message translates to:
  /// **'Сделать выходным'**
  String get actionMakeDayOff;

  /// No description provided for @actionCustomHours.
  ///
  /// In ru, this message translates to:
  /// **'Другие часы работы'**
  String get actionCustomHours;

  /// No description provided for @actionRemoveException.
  ///
  /// In ru, this message translates to:
  /// **'Убрать исключение'**
  String get actionRemoveException;

  /// No description provided for @homeScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Главная'**
  String get homeScreenTitle;

  /// No description provided for @homeAcceptingBlockedByVerification.
  ///
  /// In ru, this message translates to:
  /// **'Приём заявок откроется после проверки анкеты'**
  String get homeAcceptingBlockedByVerification;

  /// No description provided for @homeAcceptingOn.
  ///
  /// In ru, this message translates to:
  /// **'Приём заявок включён'**
  String get homeAcceptingOn;

  /// No description provided for @homeAcceptingOff.
  ///
  /// In ru, this message translates to:
  /// **'Приём заявок выключен'**
  String get homeAcceptingOff;

  /// No description provided for @homeNavConsultations.
  ///
  /// In ru, this message translates to:
  /// **'Заявки и консультации'**
  String get homeNavConsultations;

  /// No description provided for @homeNavEarnings.
  ///
  /// In ru, this message translates to:
  /// **'Доход'**
  String get homeNavEarnings;

  /// No description provided for @homeNavReviews.
  ///
  /// In ru, this message translates to:
  /// **'Отзывы'**
  String get homeNavReviews;

  /// No description provided for @offerEmergencyBadge.
  ///
  /// In ru, this message translates to:
  /// **'Срочный запрос'**
  String get offerEmergencyBadge;

  /// No description provided for @offerNewTitle.
  ///
  /// In ru, this message translates to:
  /// **'Новый оффер'**
  String get offerNewTitle;

  /// No description provided for @secondsShort.
  ///
  /// In ru, this message translates to:
  /// **'{seconds} с'**
  String secondsShort(int seconds);

  /// No description provided for @actionDecline.
  ///
  /// In ru, this message translates to:
  /// **'Отклонить'**
  String get actionDecline;

  /// No description provided for @actionAccept.
  ///
  /// In ru, this message translates to:
  /// **'Принять'**
  String get actionAccept;

  /// No description provided for @offersEmpty.
  ///
  /// In ru, this message translates to:
  /// **'Пока нет новых заявок'**
  String get offersEmpty;

  /// No description provided for @consultationsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Заявки и консультации'**
  String get consultationsScreenTitle;

  /// No description provided for @consultationsTabOffers.
  ///
  /// In ru, this message translates to:
  /// **'Заявки'**
  String get consultationsTabOffers;

  /// No description provided for @consultationsTabActive.
  ///
  /// In ru, this message translates to:
  /// **'Идёт/Плановые'**
  String get consultationsTabActive;

  /// No description provided for @consultationsTabHistory.
  ///
  /// In ru, this message translates to:
  /// **'История'**
  String get consultationsTabHistory;

  /// No description provided for @listEmpty.
  ///
  /// In ru, this message translates to:
  /// **'Пусто'**
  String get listEmpty;

  /// No description provided for @clientCode.
  ///
  /// In ru, this message translates to:
  /// **'Клиент #{code}'**
  String clientCode(int code);

  /// No description provided for @consultationStatusScheduled.
  ///
  /// In ru, this message translates to:
  /// **'Плановая запись'**
  String get consultationStatusScheduled;

  /// No description provided for @consultationStatusActive.
  ///
  /// In ru, this message translates to:
  /// **'Идёт сейчас'**
  String get consultationStatusActive;

  /// No description provided for @consultationStatusCompleted.
  ///
  /// In ru, this message translates to:
  /// **'Завершена'**
  String get consultationStatusCompleted;

  /// No description provided for @consultationStatusCancelled.
  ///
  /// In ru, this message translates to:
  /// **'Отменена'**
  String get consultationStatusCancelled;

  /// No description provided for @noteEditorTitle.
  ///
  /// In ru, this message translates to:
  /// **'Приватная заметка'**
  String get noteEditorTitle;

  /// No description provided for @noteEditorHint.
  ///
  /// In ru, this message translates to:
  /// **'Видна только вам. Не используйте медицинские диагнозы.'**
  String get noteEditorHint;

  /// No description provided for @outcomeSheetTitle.
  ///
  /// In ru, this message translates to:
  /// **'Завершить консультацию'**
  String get outcomeSheetTitle;

  /// No description provided for @outcomeCompleted.
  ///
  /// In ru, this message translates to:
  /// **'Консультация состоялась'**
  String get outcomeCompleted;

  /// No description provided for @outcomeClientNoShow.
  ///
  /// In ru, this message translates to:
  /// **'Клиент не пришёл'**
  String get outcomeClientNoShow;

  /// No description provided for @outcomeClientCancelled.
  ///
  /// In ru, this message translates to:
  /// **'Клиент отменил'**
  String get outcomeClientCancelled;

  /// No description provided for @outcomeTechIssue.
  ///
  /// In ru, this message translates to:
  /// **'Технический сбой'**
  String get outcomeTechIssue;

  /// No description provided for @consultationFinished.
  ///
  /// In ru, this message translates to:
  /// **'Консультация завершена'**
  String get consultationFinished;

  /// No description provided for @callScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Звонок'**
  String get callScreenTitle;

  /// No description provided for @callConnecting.
  ///
  /// In ru, this message translates to:
  /// **'Подключение…'**
  String get callConnecting;

  /// No description provided for @callReconnecting.
  ///
  /// In ru, this message translates to:
  /// **'Связь восстанавливается…'**
  String get callReconnecting;

  /// No description provided for @callInProgress.
  ///
  /// In ru, this message translates to:
  /// **'Звонок идёт'**
  String get callInProgress;

  /// No description provided for @callMicDenied.
  ///
  /// In ru, this message translates to:
  /// **'Нет доступа к микрофону'**
  String get callMicDenied;

  /// No description provided for @actionOpenSettings.
  ///
  /// In ru, this message translates to:
  /// **'Открыть настройки'**
  String get actionOpenSettings;

  /// No description provided for @actionBackToChat.
  ///
  /// In ru, this message translates to:
  /// **'Вернуться в чат'**
  String get actionBackToChat;

  /// No description provided for @callOfferChatFallback.
  ///
  /// In ru, this message translates to:
  /// **'Связь не восстановилась — продолжите в чате'**
  String get callOfferChatFallback;

  /// No description provided for @callFailed.
  ///
  /// In ru, this message translates to:
  /// **'Звонок не удался'**
  String get callFailed;

  /// No description provided for @sessionHeaderTitle.
  ///
  /// In ru, this message translates to:
  /// **'Клиент #{code} · {topic}'**
  String sessionHeaderTitle(int code, String topic);

  /// No description provided for @earningsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Доход'**
  String get earningsScreenTitle;

  /// No description provided for @earningsBalance.
  ///
  /// In ru, this message translates to:
  /// **'Баланс'**
  String get earningsBalance;

  /// No description provided for @actionWithdraw.
  ///
  /// In ru, this message translates to:
  /// **'Вывести'**
  String get actionWithdraw;

  /// No description provided for @earningsEmpty.
  ///
  /// In ru, this message translates to:
  /// **'Пока нет начислений'**
  String get earningsEmpty;

  /// No description provided for @earningsCommission.
  ///
  /// In ru, this message translates to:
  /// **'Комиссия: {amount}'**
  String earningsCommission(String amount);

  /// No description provided for @payoutScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Вывод средств'**
  String get payoutScreenTitle;

  /// No description provided for @payoutPendingReview.
  ///
  /// In ru, this message translates to:
  /// **'Заявка на проверке у финконтроля'**
  String get payoutPendingReview;

  /// No description provided for @payoutProcessing.
  ///
  /// In ru, this message translates to:
  /// **'Заявка одобрена, отправлена на выплату'**
  String get payoutProcessing;

  /// No description provided for @payoutPaid.
  ///
  /// In ru, this message translates to:
  /// **'Выплачено'**
  String get payoutPaid;

  /// No description provided for @payoutRejected.
  ///
  /// In ru, this message translates to:
  /// **'Заявка отклонена: {reason}'**
  String payoutRejected(String reason);

  /// No description provided for @payoutAmountLabel.
  ///
  /// In ru, this message translates to:
  /// **'Сумма, ₸'**
  String get payoutAmountLabel;

  /// No description provided for @payoutPanLabel.
  ///
  /// In ru, this message translates to:
  /// **'Номер карты'**
  String get payoutPanLabel;

  /// No description provided for @payoutHolderLabel.
  ///
  /// In ru, this message translates to:
  /// **'Имя держателя'**
  String get payoutHolderLabel;

  /// No description provided for @actionSubmitPayout.
  ///
  /// In ru, this message translates to:
  /// **'Отправить заявку'**
  String get actionSubmitPayout;

  /// No description provided for @reviewsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Отзывы'**
  String get reviewsScreenTitle;

  /// No description provided for @reviewsCount.
  ///
  /// In ru, this message translates to:
  /// **'{count} отзывов'**
  String reviewsCount(int count);

  /// No description provided for @reviewsEmpty.
  ///
  /// In ru, this message translates to:
  /// **'Пока нет отзывов'**
  String get reviewsEmpty;

  /// No description provided for @reviewYourReply.
  ///
  /// In ru, this message translates to:
  /// **'Ваш ответ'**
  String get reviewYourReply;

  /// No description provided for @notificationsScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Уведомления'**
  String get notificationsScreenTitle;

  /// No description provided for @actionMarkAllRead.
  ///
  /// In ru, this message translates to:
  /// **'Прочитать все'**
  String get actionMarkAllRead;

  /// No description provided for @notificationsEmpty.
  ///
  /// In ru, this message translates to:
  /// **'Пока нет уведомлений'**
  String get notificationsEmpty;

  /// No description provided for @profileScreenTitle.
  ///
  /// In ru, this message translates to:
  /// **'Профиль'**
  String get profileScreenTitle;

  /// No description provided for @profileLanguage.
  ///
  /// In ru, this message translates to:
  /// **'Язык'**
  String get profileLanguage;

  /// No description provided for @actionLogout.
  ///
  /// In ru, this message translates to:
  /// **'Выйти'**
  String get actionLogout;
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
