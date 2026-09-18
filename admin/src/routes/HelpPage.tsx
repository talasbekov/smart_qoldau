import { Link } from 'react-router-dom';
import { tokenStore } from '@/lib/tokenStore';
import type { AdminRole } from '@/lib/types';

const linkClass = 'inline-flex rounded-lg bg-sq-primary-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sq-primary';

function hasRole(roles: AdminRole[], role: AdminRole): boolean {
  return roles.includes('SUPERADMIN') || roles.includes(role);
}

function GuideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 text-lg font-bold">{title}</h2><div className="space-y-3 text-sm leading-6 text-sq-text-secondary">{children}</div></section>;
}

export default function HelpPage() {
  const roles = tokenStore.get()?.admin.roles ?? [];
  const ticketAccess = roles.includes('SUPERADMIN') || roles.some((role) => ['SUPPORT_OPERATOR', 'VERIFICATION_OPERATOR', 'FINANCE_CONTROL', 'QUALITY_TEAM'].includes(role));

  return (
    <div className="max-w-5xl">
      <header className="mb-7">
        <h1 className="text-2xl font-bold">Помощник</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-sq-text-secondary">Короткие инструкции по тем действиям, которые уже доступны в админке. Ссылки ниже учитывают роли текущего сотрудника.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <GuideCard title="Кто и как входит">
          <p><strong className="text-sq-text">Сотрудник админки входит по email и паролю.</strong> Учётку создаёт суперадмин в разделе «Сотрудники». Пароль должен содержать 10–100 символов, а роль определяет доступные разделы.</p>
          <p><strong className="text-sq-text">Клиент и эксперт входят по номеру телефона и коду из SMS.</strong> Клиент может зарегистрироваться на веб-странице входа или в клиентском приложении. Новый эксперт начинает в мобильном приложении эксперта: входит по телефону, заполняет профессиональный профиль и отправляет документы. Веб-кабинет эксперта предназначен для уже созданной учётной записи.</p>
          <p>Создания клиентов и экспертов вручную в админке нет. Здесь также нет общего списка пользователей, ручной выдачи им пароля или кнопки сброса их доступа.</p>
          <a href="/ru/login" className={linkClass}>Открыть вход клиента</a>
        </GuideCard>

        <GuideCard title="Как начать работу">
          <ol className="list-decimal space-y-2 pl-5"><li>Создайте отдельную учётку сотрудника и выдайте только нужные роли.</li><li>Передайте пароль для входа безопасным каналом; не публикуйте его в тикете или общем чате.</li><li>Сотрудник входит по email и паролю и включает 2FA в «Настройках».</li><li>Если вход не работает, проверьте: это email сотрудника, учётка активна, пароль не короче 10 символов при создании.</li></ol>
          <p>Кнопки сброса пароля сотрудника здесь пока нет. Если пароль утрачен, обратитесь к ответственному администратору.</p>
          <Link to="/settings" className={linkClass}>Открыть настройки</Link>
        </GuideCard>

        {hasRole(roles, 'CONTENT_EDITOR') && <GuideCard title="Материалы">
          <ol className="list-decimal space-y-2 pl-5"><li>Откройте создание материала и выберите вид.</li><li>Заполните русскую и казахскую карточки и содержимое. Для статьи используется Markdown; дыхательные фазы вводятся построчно.</li><li>Сохраните черновик. Он не виден клиентам.</li><li>Проверьте данные и нажмите «Опубликовать» в списке.</li><li>Откройте раздел «Материалы» в клиентском веб-интерфейсе и проверьте обе локали и Premium-ограничение.</li></ol>
          <p>Для аудио и обложки загрузчика сейчас нет: форма принимает уже существующий ключ приватного хранилища. Публичные URL вставлять нельзя.</p>
          <div className="flex flex-wrap gap-2"><Link to="/content/new" className={linkClass}>Создать материал</Link><Link to="/content" className={linkClass}>Открыть список</Link><a href="/ru/materials" className={linkClass}>Проверить RU</a><a href="/kk/materials" className={linkClass}>Проверить KK</a></div>
        </GuideCard>}

        {hasRole(roles, 'SUPERADMIN') && <GuideCard title="Сотрудники">
          <ol className="list-decimal space-y-2 pl-5"><li>Введите рабочий email и пароль для входа длиной 10–100 символов.</li><li>Выберите минимум одну роль. Роли можно совмещать, но не выдавайте SUPERADMIN для обычной работы.</li><li>После создания сотрудник входит на страницу админки по email и паролю.</li><li>При увольнении деактивируйте учётку — не передавайте её другому человеку.</li></ol>
          <Link to="/staff" className={linkClass}>Открыть сотрудников</Link>
        </GuideCard>}

        {hasRole(roles, 'VERIFICATION_OPERATOR') && <GuideCard title="Верификация экспертов">
          <p>В очереди откройте документы, примите решение по каждому документу и анкете. При отклонении укажите понятную причину. Изменения фото и текста «О себе» проверяются отдельно в модерации профиля.</p>
          <div className="flex flex-wrap gap-2"><Link to="/verification" className={linkClass}>Открыть верификацию</Link><Link to="/profile-moderation" className={linkClass}>Открыть профили</Link></div>
        </GuideCard>}

        {hasRole(roles, 'QUALITY_TEAM') && <GuideCard title="Качество и модерация">
          <p>Проверяйте жалобы на отзывы в «Модерации отзывов» и список экспертов ниже порога рейтинга. Скрытие или восстановление отзыва применяется только через доступные действия карточки.</p>
          <div className="flex flex-wrap gap-2"><Link to="/reviews" className={linkClass}>Открыть отзывы</Link><Link to="/flagged-experts" className={linkClass}>Открыть рейтинг</Link></div>
        </GuideCard>}

        {hasRole(roles, 'FINANCE_CONTROL') && <GuideCard title="Финансовый контроль">
          <p>В очереди выплат проверьте получателя, сумму и месячный итог. Отклонение требует причины. Раздел не создаёт платежи и не меняет банковские реквизиты пользователя.</p>
          <Link to="/payouts" className={linkClass}>Открыть выплаты</Link>
        </GuideCard>}

        {ticketAccess && <GuideCard title="Поддержка и тикеты">
          <p>Очередь показывает обращения вашей команды; суперадмин видит все команды. Откройте тикет, при необходимости назначьте его себе, ответьте и завершите только после решения вопроса.</p>
          <Link to="/tickets" className={linkClass}>Открыть тикеты</Link>
        </GuideCard>}

        <GuideCard title="Что пока отсутствует">
          <ul className="list-disc space-y-2 pl-5"><li>ручное создание и редактирование клиентов или экспертов;</li><li>сброс пароля сотрудника через админку;</li><li>загрузка аудио и обложек с компьютера;</li><li>изменение slug, категории, вида, длительности и обложки уже созданного материала.</li></ul>
          <p>Если нужной операции нет в списке, обратитесь к ответственному администратору и зафиксируйте, какое действие требуется.</p>
        </GuideCard>
      </div>
    </div>
  );
}
