export type CookTimeBucket = "15" | "30" | "45" | "60+";

export const COOK_TIME_BUCKETS: Array<{ id: CookTimeBucket; label: string; max: number | null; min: number }> = [
  { id: "15", label: "15 min", min: 0, max: 15 },
  { id: "30", label: "30 min", min: 16, max: 30 },
  { id: "45", label: "45 min", min: 31, max: 45 },
  { id: "60+", label: "1 hr+", min: 46, max: null }
];

export function matchesCookTimeBucket(cookTimeMinutes: number, bucket: CookTimeBucket): boolean {
  const range = COOK_TIME_BUCKETS.find((entry) => entry.id === bucket);
  if (!range) return true;
  if (range.max === null) return cookTimeMinutes >= range.min;
  return cookTimeMinutes >= range.min && cookTimeMinutes <= range.max;
}
