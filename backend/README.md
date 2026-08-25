<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

`npm run test:e2e` connects to the test database on port 5433 by default
(`postgresql://sq:sq@localhost:5433/smartqoldau_test`, started via
`infra/docker-compose.dev.yml`), not the dev database on 5432. Set `DATABASE_URL`
explicitly (as CI does) to override the default.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Первое развёртывание и восстановление доступа в админку

### Первый суперадмин

При пустой таблице `admin_users` сид создаёт первого суперадмина из
переменных окружения:

```
ADMIN_BOOTSTRAP_EMAIL=boss@smartqoldau.kz
ADMIN_BOOTSTRAP_PASSWORD=<не короче 12 символов>
```

Переменные не заданы — сид просто пропускается: развёртывание без них
законно, но тогда войти в админку будет некому, пока не выполнен CLI ниже.

### Восстановление доступа

Единственный путь, когда войти не может никто (пароль забыт, устройство со
вторым фактором потеряно, последний суперадмин деактивирован в обход API):

```
npm run admin:seed -- --email=boss@smartqoldau.kz --password=<новый пароль>
```

Что делает CLI:

- нет такого сотрудника — создаёт суперадмина;
- есть — перевыпускает пароль, возвращает роль `SUPERADMIN`, активирует
  учётную запись и **сбрасывает второй фактор** вместе с кодами
  восстановления: иначе потерянное устройство продолжает запирать вход даже
  с новым паролем.

### Почему нельзя остаться без суперадмина

`PATCH /v1/admin/staff/:id` выполняет деактивацию и снятие роли в
транзакции с блокировкой строк активных суперадминов и подсчётом остатка:
при нуле — `409 LAST_SUPERADMIN`. Без блокировки две параллельные
деактивации проходили бы обе (каждая транзакция видит чужую строку ещё
активной) — это поймано e2e `admin-lockout`.

### Второй фактор

`TOTP_REQUIRED=true` — сотрудник без привязанной 2FA видит только маршруты
привязки (`/v1/admin/auth/totp/setup` и `/confirm`). Сотруднику, потерявшему
устройство, второй фактор сбрасывает тот же CLI восстановления.

## Хранилище файлов

Два бакета с противоположными требованиями доступа, и это разделение
намеренное:

- `S3_BUCKET_DOCUMENTS` — документы верификации: закрыт, отдаётся только
  подписанными ссылками с TTL.
- `S3_BUCKET_AVATARS` — фотографии специалистов: публичное чтение. При
  старте сервис ставит на него политику `s3:GetObject` для всех; список
  объектов при этом закрыт, и защищает такой бакет только неугадываемость
  ключа — поэтому ключ фотографии это UUID v4, а не производная от id
  специалиста. В проде политика настраивается средствами облака, в dev её
  выставляет сам сервис в MinIO.

`S3_PUBLIC_BASE_URL` — адрес, по которому фото читает клиент (CDN или
публичный домен). Не задан — берётся `S3_ENDPOINT`.

Методы для документов и для аватаров не переиспользуют друг у друга бакет:
ошибка «положили фото в зашифрованный бакет документов» должна быть
невозможна по сигнатуре, а не по внимательности.

## Публичный профиль специалиста

Фотография и текст «о себе» — публичный контент на платформе
психологической поддержки, поэтому оба публикуются только после решения
оператора (роль `VERIFICATION_OPERATOR`, очередь
`GET /v1/admin/profile-moderation`).

У каждого поля два значения: опубликованное и то, что на проверке. Пока
новое проверяется, профиль продолжает показывать старое — это Р-18,
перенесённый с документов верификации на поля профиля. Наружу
(`ExpertPublicDto`) выходит только одобренное: значения со статусами
`PENDING` и `REJECTED` не видны никогда, как и служебные поля
`photoPendingKey`, `aboutPending` и `moderationComment`.

Фотография проверяется по фактическому содержимому через `sharp` (не по
расширению и не по `Content-Type` — подделываются оба): JPEG, PNG или
WebP, до 5 МБ, сторона от 200 px, соотношение от 1:2 до 2:1. Дальше она
пересобирается в квадрат 512×512 WebP без метаданных — EXIF снимка несёт
геолокацию и модель устройства.

Отклонение требует причины (`MODERATION_COMMENT_REQUIRED`), и специалист
видит её в `GET /v1/experts/me`. Решение по полю, которое не ждёт проверки,
отбивается как `NOTHING_TO_MODERATE`; решение берёт блокировку строки, так
что два оператора не могут одновременно одобрить и отклонить одно и то же.

Теги отзыва — закрытый словарь по оценке (`src/reviews/review-tags.ts`,
взят из прототипа). Хранятся коды, подписи живут в локализации клиента.

## Лимиты, бюджеты и уборка

Всё, что ниже, держится в Redis или в БД: значения общие для реплик, иначе
потолок множится на их число.

### Частота запросов

| Эндпоинт | Лимит | Ключ |
| --- | --- | --- |
| `POST /v1/admin/auth/login` | 5 за 15 минут | email |
| `POST /v1/auth/request-code` | 3 за час | телефон |
| `POST /v1/auth/verify-code` | 10 за 15 минут | телефон |
| `POST /v1/requests` | 10 за час | пользователь |
| `POST /v1/tickets` | 5 за час | IP (эндпоинт открыт и гостям) |

Профиль `default` (60 запросов в минуту) — страховка: он срабатывает только
там, где guard прикреплён, а свой профиль через `@Throttle` задать забыли.

Превышение отдаётся как `429 {error:{code:'RATE_LIMITED'}}`. `THROTTLE_ENABLED=false`
выключает лимиты целиком — так гоняются e2e, кроме `throttling` и
`limits-lifecycle`, которые включают их сами.

### Бюджет SMS-добивки

`SMS_EXPERT_COOLDOWN_SEC` (300), `SMS_EXPERT_DAILY_MAX` (20),
`SMS_GLOBAL_DAILY_MAX` (2000). Сутки считаются по Алматы. Отказ бюджета
пишется в audit отдельным переходом с названием сработавшего предела —
иначе он неотличим от факта отправки.

### Очередь пушей

Веер снят с пути запроса: доменное действие ставит запись в
`notification_outbox`, sweep раз в секунду забирает до 50 записей и шлёт с
конкурентностью 10, до 5 попыток с задержками 2/4/8/16 с. В e2e тик
прокручивается явно через `flushPushOutbox(app)`.

### Кэш прав админки

`ADMIN_CHECK_CACHE_SEC` (30) — насколько долго деактивированный сотрудник
или снятая роль ещё действуют. Деактивация чистит кэш сразу, так что 30
секунд — потолок для обходных правок в БД, а не обычная задержка.

### Ретенция

`RETENTION_NOTIFICATION_DAYS` (90), `RETENTION_PROVIDER_EVENT_DAYS` (30).
Уборка идёт ежечасно пачками по 1000 и **никогда** не трогает непрочитанные
уведомления; выборку держит частичный индекс
`notifications_pending_fallback_idx`. Раз в сутки итог пишется в audit.

## Журнал доступа к метаданным консультаций

ТЗ §11.7 требует не только журнал переходов состояний, но и **логи
доступа** к метаданным консультаций. За переходы отвечает
`AuditService.log`, за чтение — `AuditService.logAccess`, с четырьмя
видами доступа:

| transition | что прочитано | где пишется |
|---|---|---|
| `consultation.metadata_read` | карточка консультации (`GET /consultations/{id}`) | `ConsultationsService.findForParticipant` |
| `consultation.list_read` | свой список консультаций (`GET /consultations`) | `ConsultationsService.listForUser` |
| `consultation.messages_read` | расшифрованная переписка (`GET /consultations/{id}/messages`) | `ChatService.listHistory` |
| `consultation.note_read` | приватная заметка эксперта (`GET /consultations/{id}/note`) | `ConsultationsService.getExpertNote` |

`actorType` различает роль (`user` — клиент, `expert` — специалист): один
и тот же человек может смотреть одну консультацию в обеих ролях, и это
разные обращения. Список пишется отдельной сущностью
`consultation_list` с `entityId` = актор — иначе выборки по конкретной
консультации засорялись бы записями «смотрел список».

Повторные обращения одного актора к одному объекту схлопываются в окне
**5 минут** (ключ `audit:access:*` в Redis): смысл журнала — «кто и когда
смотрел», а не счётчик HTTP-запросов, а экран консультации
перезапрашивает карточку при каждом возврате в него. Дедупликация
**fail-open**: если Redis недоступен, запись всё равно уходит в
`audit_log` — падение кэша не должно молча выключать журнал доступа к
персональным данным.

Отказанный доступ в журнал не попадает: проверка участника
(`resolveParticipant`) отвечает 404 раньше, чем дело доходит до
`logAccess`.
