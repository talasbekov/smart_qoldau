// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kazakh (`kk`).
class AppLocalizationsKk extends AppLocalizations {
  AppLocalizationsKk([String locale = 'kk']) : super(locale);

  @override
  String get appTitle => 'SmartQoldau Маман';

  @override
  String get splashLoading => 'Кабинетіңізді жүктеп жатырмыз…';

  @override
  String get phoneScreenTitle => 'Маман үшін кіру';

  @override
  String get phoneScreenHint =>
      'Телефон нөмірін енгізіңіз — оған растау коды келеді';

  @override
  String get phoneNumberLabel => 'Телефон нөмірі';

  @override
  String get actionGetCode => 'Кодты алу';

  @override
  String get codeScreenTitle => 'Растау коды';

  @override
  String codeScreenSentTo(String phone) {
    return 'Кодты $phone нөміріне жібердік';
  }

  @override
  String get actionResendCode => 'Кодты қайта жіберу';

  @override
  String resendCodeCountdown(int seconds) {
    return '$seconds с кейін қайта жіберу';
  }

  @override
  String get actionRetry => 'Қайталау';

  @override
  String get actionNext => 'Келесі';

  @override
  String get actionSubmitProfile => 'Анкетаны жіберу';

  @override
  String get errorLoadFailed => 'Деректерді жүктеу мүмкін болмады';

  @override
  String get onboardingProfileTitle => 'Маман анкетасы — 1/2 қадам';

  @override
  String get fieldFullName => 'Аты-жөні';

  @override
  String get fieldCity => 'Қала';

  @override
  String get fieldExperience => 'Жұмыс тәжірибесі';

  @override
  String get fieldEducation => 'Білімі';

  @override
  String get fieldPriceTenge => 'Кеңес құны, ₸';

  @override
  String get fieldLanguages => 'Кеңес беру тілдері';

  @override
  String get fieldFormats => 'Кеңес беру форматтары';

  @override
  String get languageRussian => 'Орысша';

  @override
  String get languageKazakh => 'Қазақша';

  @override
  String get languageEnglish => 'Ағылшынша';

  @override
  String get experienceLessThanYear => 'Бір жылдан аз';

  @override
  String get experienceOneToThree => '1–3 жыл';

  @override
  String get experienceThreeToFive => '3–5 жыл';

  @override
  String get experienceFiveToTen => '5–10 жыл';

  @override
  String get experienceMoreThanTen => '10 жылдан астам';

  @override
  String get formatChat => 'Чат';

  @override
  String get formatAudio => 'Аудио';

  @override
  String get formatVideo => 'Бейне';

  @override
  String get onboardingTopicsTitle => 'Маман анкетасы — 2/2 қадам';

  @override
  String get onboardingTopicsHint =>
      'Жұмыс істейтін кеңес тақырыптарын таңдаңыз';

  @override
  String get documentsScreenTitle => 'Верификация құжаттары';

  @override
  String get documentTypeIdentity => 'Жеке куәлік';

  @override
  String get documentTypeDiploma => 'Білімі туралы диплом';

  @override
  String get documentTypeCertificates => 'Сертификаттар';

  @override
  String get documentTypeQualification => 'Біліктілікті растау';

  @override
  String get documentStatusNotUploaded => 'Жүктелмеген';

  @override
  String get documentStatusUploaded => 'Тексерілуде';

  @override
  String get documentStatusApproved => 'Қабылданды';

  @override
  String get documentStatusReuploadRequired => 'Қайта жіберу қажет';

  @override
  String get documentTooLarge => 'Файл 10 МБ-тан үлкен — кішірек файл таңдаңыз';

  @override
  String get actionSubmitForReview => 'Тексеруге жіберу';

  @override
  String get actionUpload => 'Жүктеу';

  @override
  String get actionReplace => 'Ауыстыру';

  @override
  String get photoScreenTitle => 'Профиль фотосы';

  @override
  String get actionUploadPhoto => 'Фото жүктеу';

  @override
  String get actionDeletePhoto => 'Фотоны жою';

  @override
  String get photoStatusNone => 'Фото жүктелмеген';

  @override
  String get photoStatusPending => 'Фото тексеруге жіберілді';

  @override
  String get photoStatusApproved => 'Фото мақұлданды';

  @override
  String get photoStatusRejected => 'Фото қабылданбады';

  @override
  String get verificationScreenTitle => 'Верификация мәртебесі';

  @override
  String get verificationDraft => 'Анкета жіберілмеген';

  @override
  String get verificationPending =>
      'Анкета тексерілуде. Қарау мерзімі — 24 сағатқа дейін';

  @override
  String get verificationVerified => 'Верификациядан өтті';

  @override
  String get fieldPhoto => 'Фото';

  @override
  String get fieldAbout => 'Өзім туралы';

  @override
  String fieldStatusNone(String field) {
    return '$field: толтырылмаған';
  }

  @override
  String fieldStatusPending(String field) {
    return '$field: тексерілуде';
  }

  @override
  String fieldStatusApproved(String field) {
    return '$field: мақұлданды';
  }

  @override
  String fieldStatusRejected(String field) {
    return '$field: қабылданбады';
  }

  @override
  String get actionReupload => 'Қайта жүктеу';

  @override
  String get weekdayMon => 'Дс';

  @override
  String get weekdayTue => 'Сс';

  @override
  String get weekdayWed => 'Ср';

  @override
  String get weekdayThu => 'Бс';

  @override
  String get weekdayFri => 'Жм';

  @override
  String get weekdaySat => 'Сб';

  @override
  String get weekdaySun => 'Жс';

  @override
  String get scheduleScreenTitle => 'Кесте';

  @override
  String get scheduleStart => 'Басталуы';

  @override
  String get scheduleEnd => 'Аяқталуы';

  @override
  String get scheduleBreakStart => 'Үзіліс басы';

  @override
  String get scheduleBreakEnd => 'Үзіліс аяғы';

  @override
  String get actionClearBreak => 'Үзілісті алып тастау';

  @override
  String get actionSave => 'Сақтау';

  @override
  String get exceptionsScreenTitle => 'Кестедегі ерекшеліктер';

  @override
  String get scheduleDayOff => 'Демалыс';

  @override
  String get actionMakeDayOff => 'Демалыс ету';

  @override
  String get actionCustomHours => 'Басқа жұмыс уақыты';

  @override
  String get actionRemoveException => 'Ерекшелікті алып тастау';

  @override
  String get homeScreenTitle => 'Басты бет';

  @override
  String get homeAcceptingBlockedByVerification =>
      'Өтінімдерді қабылдау анкета тексерілгеннен кейін ашылады';

  @override
  String get homeAcceptingOn => 'Өтінімдерді қабылдау қосулы';

  @override
  String get homeAcceptingOff => 'Өтінімдерді қабылдау өшірулі';

  @override
  String get homeNavConsultations => 'Өтінімдер мен кеңестер';

  @override
  String get homeNavEarnings => 'Табыс';

  @override
  String get homeNavReviews => 'Пікірлер';

  @override
  String get offerEmergencyBadge => 'Шұғыл сұраныс';

  @override
  String get offerNewTitle => 'Жаңа өтінім';

  @override
  String secondsShort(int seconds) {
    return '$seconds с';
  }

  @override
  String get actionDecline => 'Бас тарту';

  @override
  String get actionAccept => 'Қабылдау';

  @override
  String get offersEmpty => 'Әзірге жаңа өтінімдер жоқ';

  @override
  String get consultationsScreenTitle => 'Өтінімдер мен кеңестер';

  @override
  String get consultationsTabOffers => 'Өтінімдер';

  @override
  String get consultationsTabActive => 'Жүріп жатыр/Жоспарлы';

  @override
  String get consultationsTabHistory => 'Тарих';

  @override
  String get listEmpty => 'Бос';

  @override
  String clientCode(int code) {
    return 'Клиент #$code';
  }

  @override
  String get consultationStatusScheduled => 'Жоспарлы жазба';

  @override
  String get consultationStatusActive => 'Қазір жүріп жатыр';

  @override
  String get consultationStatusCompleted => 'Аяқталды';

  @override
  String get consultationStatusCancelled => 'Бас тартылды';

  @override
  String get noteEditorTitle => 'Жеке жазба';

  @override
  String get noteEditorHint =>
      'Тек сізге көрінеді. Медициналық диагноздарды пайдаланбаңыз.';

  @override
  String get outcomeSheetTitle => 'Кеңесті аяқтау';

  @override
  String get outcomeCompleted => 'Кеңес өтті';

  @override
  String get outcomeClientNoShow => 'Клиент келмеді';

  @override
  String get outcomeClientCancelled => 'Клиент бас тартты';

  @override
  String get outcomeTechIssue => 'Техникалық ақау';

  @override
  String get consultationFinished => 'Кеңес аяқталды';

  @override
  String get callScreenTitle => 'Қоңырау';

  @override
  String get callConnecting => 'Қосылуда…';

  @override
  String get callReconnecting => 'Байланыс қалпына келтірілуде…';

  @override
  String get callInProgress => 'Қоңырау жүріп жатыр';

  @override
  String get callMicDenied => 'Микрофонға қатынау жоқ';

  @override
  String get actionOpenSettings => 'Баптауларды ашу';

  @override
  String get actionBackToChat => 'Чатқа оралу';

  @override
  String get callOfferChatFallback =>
      'Байланыс қалпына келмеді — чатта жалғастырыңыз';

  @override
  String get callFailed => 'Қоңырау сәтсіз аяқталды';

  @override
  String sessionHeaderTitle(int code, String topic) {
    return 'Клиент #$code · $topic';
  }

  @override
  String get earningsScreenTitle => 'Табыс';

  @override
  String get earningsBalance => 'Баланс';

  @override
  String get actionWithdraw => 'Шығару';

  @override
  String get earningsEmpty => 'Әзірге есептеулер жоқ';

  @override
  String earningsCommission(String amount) {
    return 'Комиссия: $amount';
  }

  @override
  String get payoutScreenTitle => 'Қаражатты шығару';

  @override
  String get payoutPendingReview => 'Өтінім қаржы бақылауында тексерілуде';

  @override
  String get payoutProcessing => 'Өтінім мақұлданды, төлемге жіберілді';

  @override
  String get payoutPaid => 'Төленді';

  @override
  String payoutRejected(String reason) {
    return 'Өтінім қабылданбады: $reason';
  }

  @override
  String get payoutAmountLabel => 'Сома, ₸';

  @override
  String get payoutPanLabel => 'Карта нөмірі';

  @override
  String get payoutHolderLabel => 'Иесінің аты-жөні';

  @override
  String get payoutErrorAmountTooLow => 'Сома нөлден үлкен болуы керек';

  @override
  String get payoutErrorInvalidPan => 'Карта нөмірін тексеріңіз';

  @override
  String get payoutErrorInvalidExpiry => 'Мерзімі АА/ЖЖ пішімінде';

  @override
  String get actionSubmitPayout => 'Өтінімді жіберу';

  @override
  String get reviewsScreenTitle => 'Пікірлер';

  @override
  String reviewsCount(int count) {
    return '$count пікір';
  }

  @override
  String get reviewsEmpty => 'Әзірге пікірлер жоқ';

  @override
  String get reviewYourReply => 'Сіздің жауабыңыз';

  @override
  String get reviewActionReply => 'Жауап беру';

  @override
  String get reviewActionEditReply => 'Жауапты өзгерту';

  @override
  String get reviewActionComplaint => 'Шағымдану';

  @override
  String get reviewReplyDialogTitle => 'Пікірге жауап';

  @override
  String get reviewReplyHint =>
      'Жауапты барлығы көреді — консультация мәліметтерін жазбаңыз. 1000 таңбаға дейін.';

  @override
  String get reviewReplySaved => 'Жауап сақталды';

  @override
  String get reviewComplaintDialogTitle => 'Пікірге шағым';

  @override
  String get reviewComplaintHint =>
      'Пікір ережені неге бұзатынын сипаттаңыз. Модератор шешім қабылдағанша пікір жасырылады және рейтингтен шығарылады.';

  @override
  String get reviewComplaintSent =>
      'Шағым жіберілді, модератор шешім қабылдағанша пікір жасырылды';

  @override
  String get actionCancel => 'Болдырмау';

  @override
  String get notificationsScreenTitle => 'Хабарламалар';

  @override
  String get actionMarkAllRead => 'Барлығын оқылды деп белгілеу';

  @override
  String get notificationsEmpty => 'Әзірге хабарламалар жоқ';

  @override
  String get profileScreenTitle => 'Профиль';

  @override
  String get profileLanguage => 'Тіл';

  @override
  String get actionLogout => 'Шығу';

  @override
  String get webPresenceNotice =>
      'Өтінімдер осы қойынды ашық тұрғанда келеді. Жапсаңыз — қабылдау өшеді.';

  @override
  String get offersScreenTitle => 'Өтінімдер';

  @override
  String get devicesTitle => 'Камера мен микрофонды тексеріңіз';

  @override
  String get devicesCamera => 'Камера';

  @override
  String get devicesMicrophone => 'Микрофон';

  @override
  String get devicesJoin => 'Консультацияға кіру';

  @override
  String get devicesNotFound =>
      'Камера мен микрофон табылмады. Браузерде рұқсат беріп, қайталап көріңіз.';

  @override
  String get dashboardStatToday => 'Бүгін';

  @override
  String get dashboardStatCompleted => 'Аяқталды';

  @override
  String get dashboardStatEarned => 'Бүгінгі табыс';

  @override
  String get dashboardStatRating => 'Рейтинг';

  @override
  String get dashboardNextTitle => 'Ең жақын консультация';

  @override
  String get dashboardOpenConsultation => 'Консультацияны ашу';

  @override
  String dashboardGreeting(String name) {
    return 'Сәлеметсіз бе, $name 👋';
  }

  @override
  String dashboardTodayCount(int count) {
    return 'Бүгін сізде $count консультация';
  }

  @override
  String get earningsStatTotal => 'Кезең табысы';

  @override
  String get earningsStatCount => 'Консультациялар';

  @override
  String get earningsStatAverage => 'Орташа чек';

  @override
  String get earningsStatCommission => 'Платформа комиссиясы';

  @override
  String get actionSend => 'Жіберу';

  @override
  String get emergencyDisclaimerText =>
      'Платформа шұғыл қызметтерді алмастырмайды. Егер өмірге немесе денсаулыққа қауіп төнсе, тікелей хабарласыңыз:';

  @override
  String get errorGeneric => 'Бірдеңе дұрыс болмады';

  @override
  String get supportEmpty => 'Өтінімдер әзірге жоқ';

  @override
  String get supportNewTicket => 'Жаңа өтінім';

  @override
  String get supportNoReplyNotice =>
      'Бұл өтінімге қосымша жазуға болмайды — егер дерек қосу керек болса, жаңа өтінім жасаңыз';

  @override
  String get supportTitle => 'Қолдау';

  @override
  String get ticketAuthorStaff => 'Қолдау';

  @override
  String get ticketAuthorYou => 'Сіз';

  @override
  String get ticketBodyInvalid => 'Жағдайды толығырақ сипаттаңыз';

  @override
  String get ticketBodyLabel => 'Жағдайды сипаттаңыз';

  @override
  String get ticketCategoryAccountData => 'Аккаунт және деректер';

  @override
  String get ticketCategoryConsultations => 'Кеңестер';

  @override
  String get ticketCategoryLabel => 'Санат';

  @override
  String get ticketCategoryOther => 'Басқа';

  @override
  String get ticketCategoryPayment => 'Төлем';

  @override
  String get ticketCategorySecurity => 'Қауіпсіздік';

  @override
  String get ticketCategoryTechnical => 'Техникалық мәселелер';

  @override
  String get ticketStatusInProgress => 'Жұмыста';

  @override
  String get ticketStatusNew => 'Жаңа';

  @override
  String get ticketStatusResolved => 'Шешілді';

  @override
  String get ticketSubjectInvalid => 'Өтінім тақырыбын жазыңыз';

  @override
  String get ticketSubjectLabel => 'Тақырып';
}
