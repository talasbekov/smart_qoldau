export type ExpertCopy = {
  title: string;
  applicationTitle: string;
  applicationHint: string;
  existingTitle: string;
  profileTitle: string;
  save: string;
  saving: string;
  retry: string;
  support: string;
  dashboard: string;
  documents: string;
  submit: string;
  submitting: string;
  uploaded: string;
  upload: string;
  uploading: string;
  notUploaded: string;
  reupload: string;
  rejectedReasonUnavailable: string;
  pendingTitle: string;
  pendingText: string;
  verifiedTitle: string;
  verifiedText: string;
  blockedTitle: string;
  blockedText: string;
  draftText: string;
  documentHint: string;
  photo: string;
  uploadPhoto: string;
  photoPending: string;
  photoRejected: string;
  about: string;
  aboutHint: string;
  fields: Record<string, string>;
  experience: Record<string, string>;
  languages: Record<string, string>;
  formats: Record<string, string>;
  cities: string[];
  validation: string;
  genericError: string;
};

const ru: ExpertCopy = {
  title: 'Стать экспертом',
  applicationTitle: 'Анкета специалиста',
  applicationHint: 'Сначала заполните профессиональные данные, затем загрузите документы.',
  existingTitle: 'Ваша анкета специалиста',
  profileTitle: 'Профессиональный профиль',
  save: 'Сохранить изменения', saving: 'Сохраняем…', retry: 'Повторить',
  support: 'Связаться с поддержкой', dashboard: 'Перейти в кабинет', documents: 'Документы',
  submit: 'Отправить на проверку', submitting: 'Отправляем…', uploaded: 'Загружено',
  upload: 'Загрузить', uploading: 'Загрузка…', notUploaded: 'Не загружено', reupload: 'Требуется повторная загрузка',
  rejectedReasonUnavailable: 'Оператор запросил новый файл. Причина не передана сервисом — обратитесь в поддержку.',
  pendingTitle: 'Документы на проверке', pendingText: 'Проверка выполняется вручную, обычно до 24 часов. До одобрения приём консультаций недоступен.',
  verifiedTitle: 'Профиль подтверждён', verifiedText: 'Ваша анкета подтверждена. Настройте расписание и доступность в кабинете.',
  blockedTitle: 'Профиль временно заблокирован', blockedText: 'Приём новых консультаций приостановлен. Для разблокировки обратитесь в поддержку.',
  draftText: 'Загрузите все четыре документа, чтобы отправить анкету на проверку.',
  documentHint: 'PDF, JPEG или PNG, до 10 МБ. Проверяется фактический формат файла.',
  photo: 'Фотография профиля', uploadPhoto: 'Загрузить фото', photoPending: 'Фото ожидает модерации.', photoRejected: 'Фото отклонено. Загрузите другое изображение или обратитесь в поддержку.',
  about: 'О себе', aboutHint: '10–1000 символов. Текст публикуется после модерации.',
  fields: { displayName: 'Имя для профиля', city: 'Город', experience: 'Опыт', education: 'Образование', topics: 'Специализации', languages: 'Языки консультаций', formats: 'Форматы', price: 'Стоимость консультации, ₸' },
  experience: { LESS_THAN_YEAR: 'До 1 года', ONE_TO_THREE: '1–3 года', THREE_TO_FIVE: '3–5 лет', FIVE_TO_TEN: '5–10 лет', MORE_THAN_TEN: 'Более 10 лет' },
  languages: { ru: 'Русский', kz: 'Қазақша', en: 'English' }, formats: { chat: 'Чат', audio: 'Аудио', video: 'Видео' },
  cities: ['Астана', 'Алматы', 'Шымкент'],
  validation: 'Заполните обязательные поля и выберите хотя бы одну специализацию, язык и формат.',
  genericError: 'Не удалось выполнить запрос. Проверьте подключение и попробуйте снова.',
};

const kz: ExpertCopy = {
  title: 'Сарапшы болу', applicationTitle: 'Маман сауалнамасы', applicationHint: 'Алдымен кәсіби деректерді толтырыңыз, содан кейін құжаттарды жүктеңіз.',
  existingTitle: 'Сіздің маман сауалнамаңыз', profileTitle: 'Кәсіби профиль',
  save: 'Өзгерістерді сақтау', saving: 'Сақталуда…', retry: 'Қайталау',
  support: 'Қолдауға жазу', dashboard: 'Кабинетке өту', documents: 'Құжаттар',
  submit: 'Тексеруге жіберу', submitting: 'Жіберілуде…', uploaded: 'Жүктелді', upload: 'Жүктеу', uploading: 'Жүктелуде…', notUploaded: 'Жүктелмеген', reupload: 'Қайта жүктеу қажет',
  rejectedReasonUnavailable: 'Оператор жаңа файл сұрады. Себебі сервистен берілмеді — қолдауға жазыңыз.',
  pendingTitle: 'Құжаттар тексерілуде', pendingText: 'Тексеру қолмен жасалады және әдетте 24 сағатқа дейін созылады. Рұқсат берілгенше консультация қабылдау қолжетімсіз.',
  verifiedTitle: 'Профиль расталды', verifiedText: 'Сауалнамаңыз расталды. Кабинетте кесте мен қолжетімділікті баптаңыз.',
  blockedTitle: 'Профиль уақытша бұғатталды', blockedText: 'Жаңа консультацияларды қабылдау тоқтатылды. Бұғаттан шығу үшін қолдауға жазыңыз.',
  draftText: 'Сауалнаманы тексеруге жіберу үшін төрт құжаттың барлығын жүктеңіз.',
  documentHint: 'PDF, JPEG немесе PNG, 10 МБ дейін. Нақты файл пішімі тексеріледі.',
  photo: 'Профиль суреті', uploadPhoto: 'Фото жүктеу', photoPending: 'Фото модерацияны күтуде.', photoRejected: 'Фото қабылданбады. Басқа сурет жүктеңіз немесе қолдауға жазыңыз.',
  about: 'Өзі туралы', aboutHint: '10–1000 таңба. Мәтін модерациядан кейін жарияланады.',
  fields: { displayName: 'Профильдегі аты', city: 'Қала', experience: 'Тәжірибе', education: 'Білімі', topics: 'Мамандықтар', languages: 'Консультация тілдері', formats: 'Пішімдер', price: 'Консультация құны, ₸' },
  experience: { LESS_THAN_YEAR: '1 жылға дейін', ONE_TO_THREE: '1–3 жыл', THREE_TO_FIVE: '3–5 жыл', FIVE_TO_TEN: '5–10 жыл', MORE_THAN_TEN: '10 жылдан көп' },
  languages: { ru: 'Орысша', kz: 'Қазақша', en: 'English' }, formats: { chat: 'Чат', audio: 'Аудио', video: 'Видео' },
  cities: ['Астана', 'Алматы', 'Шымкент'],
  validation: 'Міндетті өрістерді толтырып, кемінде бір мамандықты, тілді және пішімді таңдаңыз.',
  genericError: 'Сұрауды орындау мүмкін болмады. Байланысты тексеріп, қайталаңыз.',
};

export function expertCopy(locale: string): ExpertCopy {
  return locale === 'kz' ? kz : ru;
}
