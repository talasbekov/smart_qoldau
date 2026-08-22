// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kazakh (`kk`).
class AppLocalizationsKk extends AppLocalizations {
  AppLocalizationsKk([String locale = 'kk']) : super(locale);

  @override
  String get appTitle => 'SmartQoldau';

  @override
  String get actionContinue => 'Жалғастыру';

  @override
  String get actionCancel => 'Бас тарту';

  @override
  String get actionRetry => 'Қайталау';

  @override
  String get actionClose => 'Жабу';

  @override
  String get actionDone => 'Дайын';

  @override
  String get actionBack => 'Артқа';

  @override
  String get languageRussian => 'Орысша';

  @override
  String get languageKazakh => 'Қазақша';

  @override
  String get errorGeneric => 'Бірдеңе дұрыс болмады';

  @override
  String get errorValidationFailed => 'Енгізілген деректерді тексеріңіз';

  @override
  String get errorUnauthorized => 'Сессия аяқталды, қайта кіріңіз';

  @override
  String get errorForbidden => 'Бұл әрекетке рұқсатыңыз жоқ';

  @override
  String get errorNotFound => 'Сұралған деректер табылмады';

  @override
  String get errorConflict => 'Әрекет ағымдағы жағдаймен сәйкес келмейді';

  @override
  String get errorRateLimited => 'Әрекеттер тым жиі, сәл кідіріңіз';

  @override
  String get errorInternal => 'Серверде қате пайда болды, кейінірек қайталаңыз';

  @override
  String get errorSmsCodeInvalid => 'Код қате';

  @override
  String get errorSmsCodeExpired => 'Кодтың мерзімі өтті, жаңасын сұраңыз';

  @override
  String get errorSmsRateLimited => 'Әрекеттер тым жиі, сәлден соң қайталаңыз';

  @override
  String get errorPhoneAlreadyRegistered => 'Бұл нөмір бұрын тіркелген';

  @override
  String get errorActiveRequestExists => 'Сізде белсенді өтінім бар';

  @override
  String get errorExpertUnavailable => 'Маман қазір қолжетімсіз';

  @override
  String get errorExpertNotFound => 'Маман табылмады';

  @override
  String get errorExpertBlocked => 'Маман кеңестерге қолжетімсіз';

  @override
  String get errorRequestNotFound => 'Өтінім табылмады';

  @override
  String get errorRequestAlreadyClosed => 'Өтінім жабылған';

  @override
  String get errorConsultationNotFound => 'Кеңес табылмады';

  @override
  String get errorConsultationNotActive => 'Кеңес аяқталған';

  @override
  String get errorPaymentMethodNotFound => 'Төлем әдісі табылмады';

  @override
  String get errorPaymentNotFound => 'Төлем табылмады';

  @override
  String get errorProviderDeclined => 'Төлемді банк қабылдамады';

  @override
  String get errorAlreadyPaid => 'Бұрын төленген';

  @override
  String get errorReviewExists => 'Сіз пікір қалдырып қойдыңыз';

  @override
  String get errorReviewNotFound => 'Пікір табылмады';

  @override
  String get errorNotificationNotFound => 'Хабарландыру табылмады';

  @override
  String get errorDeviceNotFound => 'Құрылғы табылмады';

  @override
  String get errorTicketNotFound => 'Өтініш табылмады';

  @override
  String get errorTicketContactRequired => 'Байланысу үшін контакт көрсетіңіз';

  @override
  String get errorTicketCategoryNotAllowed =>
      'Бұл санат өтініш үшін қолжетімсіз';

  @override
  String get errorTicketAlreadyResolved => 'Өтініш шешілген';

  @override
  String get errorNetwork => 'Сервермен байланыс жоқ';

  @override
  String get splashTagline => 'Керек кезде қолдау жаныңызда';

  @override
  String get phoneScreenTitle => 'Телефон нөмірі арқылы кіру';

  @override
  String get phoneScreenSubtitle => 'Бұл бір минуттан аз уақыт алады';

  @override
  String get phoneNumberLabel => 'Телефон нөмірі';

  @override
  String get phoneNumberHint => 'XX) XXX-XX-XX';

  @override
  String get phoneScreenHelper => 'SMS арқылы бір реттік код жібереміз';

  @override
  String get actionGetCode => 'Кодты алу';

  @override
  String get codeScreenTitle => 'SMS-тен келген кодты енгізіңіз';

  @override
  String codeScreenSubtitle(String phone) {
    return 'Код $phone нөміріне жіберілді';
  }

  @override
  String get actionResendCode => 'Қайта жіберу';

  @override
  String resendCodeCountdown(int seconds) {
    return '$seconds с кейін қайта жіберу';
  }

  @override
  String get welcomeTitle => 'SmartQoldau-ға қош келдіңіз';

  @override
  String get welcomeSubtitle =>
      'Психологиялық қолдау жаныңызда — дайын болған кезде айтыңыз';

  @override
  String get actionLoginByPhone => 'Нөмір арқылы кіру';

  @override
  String get actionContinueAnonymously => 'Анонимді түрде жалғастыру';

  @override
  String get welcomeTermsLink => 'Пайдаланушы келісімі';

  @override
  String get welcomePrivacyLink => 'Құпиялылық саясаты';

  @override
  String get slidesTitle1 => 'Кеңес берудің әртүрлі форматтары';

  @override
  String get slidesDescription1 =>
      'Психологпен чатта, аудио немесе бейне арқылы сөйлесіңіз — өзіңізге ыңғайлы форматты таңдаңыз';

  @override
  String get slidesTitle2 => 'Құпия және анонимді';

  @override
  String get slidesDescription2 =>
      'Тіркелусіз жүгінуге болады: атыңызды көрсету міндетті емес, деректеріңіз қорғалған';

  @override
  String get slidesTitle3 => '1–2 минутта жауап';

  @override
  String get slidesDescription3 =>
      'Психолог дерлік бірден байланысқа шығады — сағаттап күтудің қажеті жоқ';

  @override
  String get slidesSkip => 'Өткізіп жіберу';

  @override
  String get slidesNext => 'Келесі';

  @override
  String get slidesStart => 'Бастау';

  @override
  String get permissionsTitle => 'Рұқсаттар';

  @override
  String get permissionsSubtitle =>
      'Психологпен қоңырауда қажет болады — бұл рұқсаттарды кейінірек те баптауға болады';

  @override
  String get permissionMicrophoneTitle => 'Микрофон';

  @override
  String get permissionMicrophoneDescription =>
      'Психологпен аудио кеңес үшін қажет';

  @override
  String get permissionCameraTitle => 'Камера';

  @override
  String get permissionCameraDescription =>
      'Психологпен бейне кеңес үшін қажет';

  @override
  String get permissionNotificationsTitle => 'Хабарландырулар';

  @override
  String get permissionNotificationsDescription =>
      'Психолог жауап бергенде немесе кеңес басталғанда хабарлаймыз';

  @override
  String get actionAllow => 'Рұқсат ету';

  @override
  String get actionLater => 'Кейінірек';
}
