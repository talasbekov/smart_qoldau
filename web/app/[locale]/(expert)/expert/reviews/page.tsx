import { authorizedFetch } from '@/lib/api/authorized';
import ReviewList from '@/components/expert-cabinet/ReviewList';
import type { components } from '@/lib/api/generated';

type OwnReviews = {
  items: components['schemas']['OwnReviewItemDto'][];
  distribution: Record<string, number>;
  ratingAvg: number;
  ratingCount: number;
};

export default async function ReviewsPage() {
  const reviews = await authorizedFetch<OwnReviews>('experts/me/reviews');

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Рейтинг и отзывы</h1>
      <ReviewList
        items={reviews?.items ?? []}
        ratingAvg={reviews?.ratingAvg ?? 0}
        ratingCount={reviews?.ratingCount ?? 0}
        distribution={reviews?.distribution ?? {}}
      />
    </>
  );
}
