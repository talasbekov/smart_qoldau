CREATE TYPE "ContentKind" AS ENUM ('MEDITATION', 'MUSIC', 'ARTICLE', 'BREATHING');
CREATE TYPE "ContentAccess" AS ENUM ('FREE', 'PREMIUM');

CREATE TABLE "content_items" (
  "id" TEXT NOT NULL,
  "kind" "ContentKind" NOT NULL,
  "access" "ContentAccess" NOT NULL DEFAULT 'FREE',
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_kk" TEXT NOT NULL,
  "summary_ru" TEXT NOT NULL,
  "summary_kk" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "duration_sec" INTEGER,
  "cover_key" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "useful_yes" INTEGER NOT NULL DEFAULT 0,
  "useful_no" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_items_slug_key" ON "content_items" ("slug");
-- Рабочий запрос списка: вид + опубликованные + порядок редактора.
CREATE INDEX "content_items_kind_published_at_sort_order_idx"
  ON "content_items" ("kind", "published_at", "sort_order");
CREATE INDEX "content_items_category_published_at_idx"
  ON "content_items" ("category", "published_at");

CREATE TABLE "content_progress" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "position_permille" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_progress_pkey" PRIMARY KEY ("id")
);

-- Один прогресс на пару (пользователь, материал): иначе «сколько
-- прочитано» перестаёт быть однозначным.
CREATE UNIQUE INDEX "content_progress_user_id_item_id_key"
  ON "content_progress" ("user_id", "item_id");
-- Рабочий запрос стрика: дни активности пользователя.
CREATE INDEX "content_progress_user_id_updated_at_idx"
  ON "content_progress" ("user_id", "updated_at");

CREATE TABLE "content_votes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "useful" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_votes_user_id_item_id_key"
  ON "content_votes" ("user_id", "item_id");

ALTER TABLE "content_progress" ADD CONSTRAINT "content_progress_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Материал удаляют вместе со следами: прогресс и голоса без материала
-- бессмысленны, а редактор не должен упираться в чужие строки.
ALTER TABLE "content_progress" ADD CONSTRAINT "content_progress_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_votes" ADD CONSTRAINT "content_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_votes" ADD CONSTRAINT "content_votes_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
