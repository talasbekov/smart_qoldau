// Обычный <img>, а не next/image, намеренно. Бэкенд уже приводит аватар к
// 512×512 WebP без EXIF (photo.service.ts), то есть размер и формат
// оптимальны в источнике; оптимизатор Next только прогнал бы каждую
// картинку через свой сервер ради того же результата, а его allowlist
// доменов пришлось бы держать синхронным с адресом хранилища на каждом
// стенде. Ширина и высота заданы явно — без них место под картинку не
// зарезервировано и страница дёргается при загрузке.
export default function ExpertAvatar({
  photoUrl,
  size,
}: {
  photoUrl: string | null;
  size: number;
}) {
  if (!photoUrl) {
    return (
      <div
        className="shrink-0 rounded-full bg-chip"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full bg-chip object-cover"
    />
  );
}
