export type TrendDirection = "up" | "down" | "flat";

/**
 * Endurance/nutrition trend strings are free text from the backend (e.g. "+5 this week",
 * "Flat", "2 synced sessions") rather than a structured enum - this infers a display direction
 * from a leading +/- sign so the UI can color-code and arrow-badge it without a backend change.
 */
export function inferTrendDirection(text: string): TrendDirection {
  const trimmed = text.trim();
  if (trimmed.startsWith("+")) return "up";
  if (trimmed.startsWith("-")) return "down";
  return "flat";
}

export const TREND_ARROW: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→"
};
