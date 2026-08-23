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

  @override
  String get navHome => 'Басты бет';

  @override
  String get navCatalog => 'Каталог';

  @override
  String get navConsultations => 'Кеңестер';

  @override
  String get navProfile => 'Профиль';

  @override
  String get homeGreeting => 'Сәлеметсіз бе';

  @override
  String get homeEmergencyCta => 'Маған қазір көмек керек';

  @override
  String get homeEmergencyCtaSubtitle =>
      'Қосылудың орташа уақыты — 2 минутқа дейін';

  @override
  String get homeTopicsTitle => 'Біз мына мәселелермен көмектесеміз:';

  @override
  String get homeTopicsSubtitle => 'немесе сізді нақты не мазалайтынын айтыңыз';

  @override
  String get homeActiveConsultationTitle => 'Белсенді кеңес';

  @override
  String get homeEmergencyNoticeTitle => 'Төтенше жағдай';

  @override
  String get homeEmergencyNoticeBody =>
      'Бізде дәл қазір басымдық тәртібімен қосыла алатын мамандар бар';

  @override
  String get emergencyDisclaimerText =>
      'Платформа шұғыл қызметтерді алмастырмайды. Егер өмірге немесе денсаулыққа қауіп төнсе, тікелей хабарласыңыз:';

  @override
  String get topicTitle => 'Сізді не мазалайтынын айтыңыз';

  @override
  String get topicSubtitle =>
      'Тақырыпты тексеріп, қарым-қатынас форматын таңдаңыз — біз қолайлы маман табамыз';

  @override
  String get topicFormatLabel => 'Қарым-қатынас форматы';

  @override
  String get topicFormatNotChosen => 'Форматты таңдаңыз';

  @override
  String get formatChat => 'Чат';

  @override
  String get formatAudio => 'Аудио';

  @override
  String get formatVideo => 'Бейне';

  @override
  String get formatSheetTitle => 'Сізге қалай ыңғайлы?';

  @override
  String get formatSheetCaption => '50 минут · бағасы маманға байланысты';

  @override
  String get funnelActiveRequestTitle => 'Сізде белсенді өтінім бар';

  @override
  String get funnelActiveRequestBody =>
      'Оның жауабын күтіңіз немесе жаңасын құру үшін оны тоқтатыңыз';

  @override
  String get searchTitle => 'Сізге қолайлы психологты таңдап жатырмыз';

  @override
  String get searchSubtitle => 'Бұл 2 минуттан аспайды';

  @override
  String get searchHint =>
      'Біз мамандығын, тілін және қазіргі қолжетімділігін ескереміз';

  @override
  String get searchElapsedLabel => 'Іздеу жүріп жатыр';

  @override
  String get searchEncouragement =>
      'Көмекке жүгініп, сіз маңызды қадам жасадыңыз';

  @override
  String get searchCancel => 'Іздеуді тоқтату';

  @override
  String get noExpertsTitle => 'Қазір бос мамандар жоқ';

  @override
  String get noExpertsBody =>
      'Бірнеше минуттан кейін қайталап көріңіз немесе басты бетке оралыңыз';

  @override
  String get actionTryAgain => 'Қайта көру';

  @override
  String get actionGoHome => 'Басты бетке';

  @override
  String searchOnlineCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count маман',
      one: '$count маман',
    );
    return 'Қазір желіде: $_temp0';
  }

  @override
  String get emergencyScreeningTitle => 'Сізге дәл қазір қауіп төніп тұр ма?';

  @override
  String get emergencyScreeningBody =>
      'Шынын айтыңыз — алдымен қалай көмектесетініміз соған байланысты';

  @override
  String get emergencyScreeningFormatHint => 'Таңдау форматын өзгертуге болады';

  @override
  String get actionYes => 'Иә';

  @override
  String get actionNo => 'Жоқ';

  @override
  String get emergencyDangerTitle =>
      'Өмірге қауіп болса — тікелей хабарласыңыз';

  @override
  String get emergencyDangerBody =>
      'Платформа шұғыл қызметтерді алмастырмайды. Нөмірлердің біріне қоңырау шалыңыз — бұл ең жылдам жол';

  @override
  String get emergencyCallPolice => '102-ге қоңырау шалу';

  @override
  String get emergencyCallAmbulance => '103-ке қоңырау шалу';

  @override
  String get emergencyContinueSearch =>
      'Маған қауіп жоқ, маман таңдауды жалғастыру';

  @override
  String get emergencySearchBadge => 'Басым іздеу';

  @override
  String get emergencySearchTitle => 'Сізге бос маман іздеп жатырмыз';

  @override
  String get emergencySearchSubtitle =>
      'Сізді кезекте бірінші қосамыз. Ауырлап кетсе — 103-ке қоңырау шалуға болады';

  @override
  String get emergencySearchEncouragement =>
      'Сіз жалғыз емессіз — маманды қазір қосып жатырмыз';

  @override
  String get emergencyCallServices => '103 / 112-ге қоңырау шалу';

  @override
  String get hotlinesTitle => 'Біз сізге қайта қоңырау шаламыз';

  @override
  String get hotlinesBody =>
      'Кері қоңырауға өтінім жасалды — бірінші босаған маман сізбен байланысады. Әзірше мына нөмірлерге қоңырау шалуға болады:';

  @override
  String hotlineCall(String number) {
    return '$number нөміріне қоңырау шалу';
  }

  @override
  String get hotlineName150 => 'Сенім телефоны';

  @override
  String get hotlineName103 => 'Жедел жәрдем';

  @override
  String get hotlineName112 => 'Бірыңғай құтқару қызметі';

  @override
  String get foundTitle => 'Маман табылды!';

  @override
  String get foundOnline => 'Қазір байланыста';

  @override
  String get foundStart => 'Кеңесті бастау';

  @override
  String get foundCancel => 'Кеңестен бас тарту';

  @override
  String expertLanguages(String languages) {
    return 'Тілдері: $languages';
  }

  @override
  String get expertExperienceLabel => 'Тәжірибесі';

  @override
  String get experienceLessThanYear => 'бір жылдан аз';

  @override
  String get experienceOneToThree => '1–3 жыл';

  @override
  String get experienceThreeToFive => '3–5 жыл';

  @override
  String get experienceFiveToTen => '5–10 жыл';

  @override
  String get experienceMoreThanTen => '10 жылдан астам';

  @override
  String get paymentSheetTitle => 'Кеңес ақысын төлеу';

  @override
  String get paymentLineItem => 'Кеңес';

  @override
  String get paymentEscrowNote =>
      'Ақша картада бұғатталады және кеңес өткеннен кейін ғана есептен шығарылады';

  @override
  String get paymentPay => 'Төлеу';

  @override
  String get paymentAddCard => 'Карта қосу';

  @override
  String get paymentNoCards => 'Әзірге тіркелген карта жоқ';

  @override
  String get paymentDeclinedTitle => 'Төлем қабылданбады';

  @override
  String get paymentAnotherCard => 'Басқа карта';

  @override
  String get cardsTitle => 'Менің карталарым';

  @override
  String get cardsEmpty => 'Карталар әзірге жоқ';

  @override
  String get cardDeleteTitle => 'Картаны алып тастау керек пе?';

  @override
  String cardDeleteBody(String maskedPan) {
    return '$maskedPan картасы бұдан былай төлеуге қолжетімсіз болады';
  }

  @override
  String get actionDelete => 'Алып тастау';

  @override
  String get actionSave => 'Сақтау';

  @override
  String get addCardTitle => 'Жаңа карта';

  @override
  String get cardNumberLabel => 'Карта нөмірі';

  @override
  String get cardExpiryLabel => 'Жарамдылық мерзімі';

  @override
  String get cardHolderLabel => 'Картадағы аты';

  @override
  String get cardNumberInvalid => 'Карта нөмірін тексеріңіз';

  @override
  String get cardExpiryInvalid => 'Мерзімі АА/ЖЖ пішімінде';

  @override
  String get cardHolderInvalid => 'Картадағыдай атыңызды жазыңыз';

  @override
  String paymentDuration(num minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes минут',
      one: '$minutes минут',
    );
    return '$_temp0';
  }

  @override
  String expertReviewsCount(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count пікір',
      one: '$count пікір',
    );
    return '$_temp0';
  }

  @override
  String get chatInputHint => 'Хабарлама жазыңыз...';

  @override
  String get chatConfidentialNotice =>
      'Мұнда ашық сөйлесуге болады. Барлық хабарламалар құпия';

  @override
  String get chatSending => 'жіберілуде';

  @override
  String get chatFailed => 'жіберілмеді';

  @override
  String get chatPeerTyping => 'жазып жатыр…';

  @override
  String get chatInputDisabled => 'Кеңес аяқталды — енді жазуға болмайды';

  @override
  String get sessionOnline => 'Байланыста';

  @override
  String sessionRemaining(String time) {
    return '$time қалды';
  }

  @override
  String get sessionTimeUp => 'Кеңес уақыты аяқталды';

  @override
  String get sessionCancelTitle => 'Кеңесті тоқтату керек пе?';

  @override
  String get sessionCancelBody => 'Уақыт басқа пайдаланушыға босайды';

  @override
  String get sessionMenuCancel => 'Кеңесті тоқтату';

  @override
  String get callAudioTitle => 'Аудиокеңес';

  @override
  String get callVideoTitle => 'Бейнекеңес';

  @override
  String get callConnecting => 'Қосылып жатырмыз…';

  @override
  String get callConnected => 'Байланыста';

  @override
  String get callReconnecting =>
      'Байланыс қалпына келтірілуде, сұхбаттасыңыз желіде қалады';

  @override
  String get callFailedTitle => 'Байланыс қалпына келмеді';

  @override
  String get callContinueInChat => 'Чатта жалғастыру';

  @override
  String get callEnd => 'Аяқтау';

  @override
  String get callMic => 'Микрофон';

  @override
  String get callCamera => 'Камера';

  @override
  String get callCameraBlocked =>
      'Камера қолжетімсіз — дауыстық сөйлесу жүріп жатыр';

  @override
  String get callPermissionTitle => 'Микрофонға рұқсат қажет';

  @override
  String get callPermissionBody =>
      'Микрофонсыз аудио- немесе бейнекеңес өткізу мүмкін емес. Рұқсатты қолданба параметрлерінде беруге болады';

  @override
  String get callOpenSettings => 'Параметрлерді ашу';

  @override
  String get sessionMenuAudio => 'Аудиоға көшу';

  @override
  String get sessionMenuVideo => 'Бейнеге көшу';

  @override
  String get reviewTitle => 'SmartQoldau-ға сенгеніңіз үшін рақмет';

  @override
  String get reviewRatingQuestion => 'Кеңес қалай өтті?';

  @override
  String get reviewPublicLabel => 'Ашық пікір';

  @override
  String get reviewPublicHint => 'Басқа клиенттерге көрінеді, атыңызсыз';

  @override
  String get reviewPrivateLabel => 'Сапа тобына жеке';

  @override
  String get reviewPrivateHint =>
      'Пікірді тек SmartQoldau сапа тобы көреді — психолог көрмейді';

  @override
  String get reviewSend => 'Аяқтау';

  @override
  String get reviewSkip => 'Өткізіп жіберу';

  @override
  String get reviewContinueSameExpert => 'Сол психологпен жалғастыру';

  @override
  String get reviewExistsTitle => 'Сіз бұл кеңеске баға бердіңіз';

  @override
  String get reviewRating1 => 'Нашар';

  @override
  String get reviewRating2 => 'Орташа';

  @override
  String get reviewRating3 => 'Қалыпты';

  @override
  String get reviewRating4 => 'Жақсы';

  @override
  String get reviewRating5 => 'Тамаша';

  @override
  String get catalogTitle => 'Мамандар';

  @override
  String get catalogFilters => 'Сүзгілер';

  @override
  String get catalogEmpty => 'Бұл сүзгілер бойынша ешкім табылмады';

  @override
  String get catalogResetFilters => 'Сүзгілерді тазалау';

  @override
  String get filterTopic => 'Тақырып';

  @override
  String get filterLanguage => 'Тіл';

  @override
  String get filterFormat => 'Формат';

  @override
  String get filterSort => 'Сұрыптау';

  @override
  String get filterAny => 'Кез келген';

  @override
  String get sortPriceAsc => 'Алдымен арзаны';

  @override
  String get sortPriceDesc => 'Алдымен қымбаты';

  @override
  String get sortRating => 'Рейтинг бойынша';

  @override
  String get actionApply => 'Қолдану';

  @override
  String get favoritesTitle => 'Таңдаулылар';

  @override
  String get favoritesEmpty => 'Әзірге ешкім қосылмаған';

  @override
  String get expertTopicsTitle => 'Тақырыптар';

  @override
  String get expertReviewsTitle => 'Пікірлер';

  @override
  String get expertNoReviews => 'Пікірлер әзірге жоқ';

  @override
  String get expertReplyPrefix => 'Маманның жауабы';

  @override
  String get expertPriceLabel => 'Кеңес';

  @override
  String get expertUnavailableTitle => 'Маман қазір қолжетімсіз';

  @override
  String get expertUnavailableBody =>
      'Осы тақырып бойынша басқа бос маманды таңдауға болады';

  @override
  String get expertPickAutomatically => 'Автоматты түрде таңдау';

  @override
  String get expertLoadMoreReviews => 'Тағы пікірлерді көрсету';

  @override
  String get consultationsActiveTab => 'Белсенді';

  @override
  String get consultationsHistoryTab => 'Тарих';

  @override
  String get consultationsEmptyActive => 'Белсенді кеңестер жоқ';

  @override
  String get consultationsEmptyHistory => 'Тарих әзірге бос';

  @override
  String get consultationContinue => 'Жалғастыру';

  @override
  String get consultationCancel => 'Тоқтату';

  @override
  String get consultationRepeat => 'Қайта жазылу';

  @override
  String get consultationDetailsTitle => 'Кеңес';

  @override
  String get consultationLoadMore => 'Тағы көрсету';

  @override
  String get paymentStatusHeld => 'Ақша бұғатталған';

  @override
  String get paymentStatusCaptured => 'Төленген';

  @override
  String get paymentStatusVoided => 'Қайтарылған';

  @override
  String get paymentStatusFailed => 'Төлем өтпеді';

  @override
  String get paymentStatusUnpaid => 'Төлемді күтуде';

  @override
  String paymentPaidWithCard(String maskedPan) {
    return '$maskedPan картасымен төленген';
  }

  @override
  String get consultationStatusActive => 'Жүріп жатыр';

  @override
  String get consultationStatusCompleted => 'Аяқталды';

  @override
  String get consultationStatusCancelled => 'Тоқтатылды';

  @override
  String get outcomeCompleted => 'Өтті';

  @override
  String get outcomeClientNoShow => 'Сіз қосылмадыңыз';

  @override
  String get outcomeClientCancelled => 'Сіз тоқтаттыңыз';

  @override
  String get outcomeTechIssue => 'Техникалық ақау';

  @override
  String get myReviewTitle => 'Сіздің пікіріңіз';

  @override
  String get reviewDeleteTitle => 'Пікірді жою керек пе?';

  @override
  String get reviewDeleteBody => 'Маманның рейтингі қайта есептеледі';

  @override
  String get reviewDelete => 'Пікірді жою';

  @override
  String get funnelActiveRequestGoTo => 'Кеңеске өту';

  @override
  String get notificationsTitle => 'Хабарландырулар';

  @override
  String get notificationsEmpty => 'Хабарландырулар әзірге жоқ';

  @override
  String get notificationsMarkAllRead => 'Барлығын оқылды деп белгілеу';

  @override
  String get profileGuestTitle => 'Аккаунт жасаңыз';

  @override
  String get profileGuestBody =>
      'Белсенді кеңес пен тіркелген карта сақталады, ал құрылғыны ауыстырғанда тарихқа қолжетімділік қалады';

  @override
  String get profileCreateAccount => 'Аккаунт жасау';

  @override
  String profileCompletedConsultations(num count) {
    return 'Аяқталған кеңестер: $count';
  }

  @override
  String get profilePaymentMethods => 'Төлем әдістері';

  @override
  String get profileNotifications => 'Хабарландырулар';

  @override
  String get profileLanguage => 'Тіл';

  @override
  String get profileSupport => 'Қолдау';

  @override
  String get profileTerms => 'Пайдаланушы келісімі';

  @override
  String get profilePrivacy => 'Құпиялылық саясаты';

  @override
  String get profileDeleteAccount => 'Аккаунтты жою';

  @override
  String get profileLogout => 'Шығу';

  @override
  String get profileLogoutTitle => 'Аккаунттан шығу керек пе?';

  @override
  String get profileLogoutBody => 'Телефон нөмірімен қайта кіре аласыз';

  @override
  String get profileLogoutGuestBody =>
      'Бұл қонақ сессиясы: шыққаннан кейін оның деректері біржола жоғалады — кеңестер тарихы мен тіркелген карта қалпына келмейді';

  @override
  String get profileDeleteAccountTitle =>
      'Аккаунт пен деректерді жою керек пе?';

  @override
  String get profileDeleteAccountBody =>
      'Біз қолдау қызметіне өтінім жасаймыз — команда сізбен байланысып, жоюды растайды';

  @override
  String get profileDeleteAccountSubject => 'Аккаунт пен деректерді жою';

  @override
  String get profileDeleteAccountTicketBody =>
      'Аккаунтымды және онымен байланысты деректерді жоюды сұраймын';

  @override
  String get convertGuestTitle => 'Аккаунт жасау';

  @override
  String get convertGuestPhoneAlreadyUsed =>
      'Бұл нөмір тіркелген. Ол аккаунтқа кіру бетінен кіруге болады, бірақ қонақ сессиясының деректері оған көшпейді';

  @override
  String get supportTitle => 'Қолдау';

  @override
  String get supportEmpty => 'Өтінімдер әзірге жоқ';

  @override
  String get supportNewTicket => 'Жаңа өтінім';

  @override
  String get supportNoReplyNotice =>
      'Бұл өтінімге қосымша жазуға болмайды — егер дерек қосу керек болса, жаңа өтінім жасаңыз';

  @override
  String get ticketSubjectLabel => 'Тақырып';

  @override
  String get ticketBodyLabel => 'Жағдайды сипаттаңыз';

  @override
  String get ticketCategoryLabel => 'Санат';

  @override
  String get ticketSubjectInvalid => 'Өтінім тақырыбын жазыңыз';

  @override
  String get ticketBodyInvalid => 'Жағдайды толығырақ сипаттаңыз';

  @override
  String get ticketAuthorYou => 'Сіз';

  @override
  String get ticketAuthorStaff => 'Қолдау';

  @override
  String get ticketStatusNew => 'Жаңа';

  @override
  String get ticketStatusInProgress => 'Жұмыста';

  @override
  String get ticketStatusResolved => 'Шешілді';

  @override
  String get ticketCategoryConsultations => 'Кеңестер';

  @override
  String get ticketCategoryPayment => 'Төлем';

  @override
  String get ticketCategoryTechnical => 'Техникалық мәселелер';

  @override
  String get ticketCategoryAccountData => 'Аккаунт және деректер';

  @override
  String get ticketCategorySecurity => 'Қауіпсіздік';

  @override
  String get ticketCategoryOther => 'Басқа';

  @override
  String get actionSend => 'Жіберу';

  @override
  String get sessionMenuReport => 'Мәселе туралы хабарлау';

  @override
  String get languageEnglish => 'Ағылшынша';

  @override
  String get reviewTagNotHelpful => 'Көмектеспеді';

  @override
  String get reviewTagLongWait => 'Ұзақ күту';

  @override
  String get reviewTagBadConnection => 'Байланыс нашар';

  @override
  String get reviewTagLittleUse => 'Пайдасы аз';

  @override
  String get reviewTagDidNotUnderstand => 'Мені түсінбеді';

  @override
  String get reviewTagTechnicalIssues => 'Техникалық ақаулар';

  @override
  String get reviewTagAverage => 'Орташа';

  @override
  String get reviewTagCouldBeBetter => 'Жақсырақ болуы мүмкін еді';

  @override
  String get reviewTagStandard => 'Қалыпты';

  @override
  String get reviewTagAttentive => 'Мұқият';

  @override
  String get reviewTagHelpedFigureOut => 'Түсінуге көмектесті';

  @override
  String get reviewTagProfessional => 'Кәсіби';

  @override
  String get reviewTagExceededExpectations => 'Күткеннен де жақсы';

  @override
  String get reviewTagsHint => 'Не маңызды болды?';

  @override
  String get bookingTitle => 'Уақытты таңдау';

  @override
  String get bookingTimezoneNote => 'Уақыт Алматы бойынша көрсетілген';

  @override
  String get bookingNoSlotsDay => 'Бұл күні бос уақыт жоқ';

  @override
  String get bookingChooseCard => 'Картаны таңдаңыз';

  @override
  String get bookingConfirm => 'Жазылу';

  @override
  String get bookingSlotTaken => 'Бұл уақытты жаңа ғана алып қойды';

  @override
  String get rescheduleTitle => 'Консультацияны ауыстыру';

  @override
  String get rescheduleConfirm => 'Ауыстыру';

  @override
  String get consultationScheduled => 'Жоспарланған';

  @override
  String get consultationCancelLateWarning =>
      '2 сағаттан аз уақыт қалғанда бас тарту есепке алынады. 30 күнде үш рет бас тарту автоматты іріктеуді өшіреді.';

  @override
  String consultationStartsIn(String duration) {
    return '$duration кейін';
  }

  @override
  String get bookingActionSchedule => 'Уақытқа жазылу';

  @override
  String get bookingActionNow => 'Қазір байланысу';

  @override
  String get outcomeExpertCancelled => 'Маман бас тартты';
}
