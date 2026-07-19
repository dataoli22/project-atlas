import type { NutritionVideoLink } from "@atlas/shared";

/**
 * Pragmatic, best-effort client-side match between a meal/dish name and a curated video link.
 * There is no direct day/meal -> video foreign key in the data model (video_links is a flat,
 * market-scoped resource list, not tied to a specific calendar day or dish) - so this does a
 * case-insensitive substring match against a video's topic or title. Returns null (never a
 * fabricated match) when nothing lines up, so callers should treat a null result as "no video for
 * this meal" rather than retrying with a looser rule.
 */
export function matchVideoForMeal(
  mealTitle: string,
  videoLinks: NutritionVideoLink[]
): NutritionVideoLink | null {
  const normalizedMeal = mealTitle.trim().toLowerCase();
  if (!normalizedMeal) {
    return null;
  }

  for (const video of videoLinks) {
    const topic = video.topic.trim().toLowerCase();
    const title = video.title.trim().toLowerCase();
    if (!topic && !title) {
      continue;
    }
    if (
      (topic && (normalizedMeal.includes(topic) || topic.includes(normalizedMeal))) ||
      (title && (normalizedMeal.includes(title) || title.includes(normalizedMeal)))
    ) {
      return video;
    }
  }

  return null;
}
