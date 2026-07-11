import { inferTrendDirection, TREND_ARROW } from "@/lib/trend";

export function TrendBadge({ text }: { text: string }) {
  const direction = inferTrendDirection(text);

  return (
    <span className={`atlas-trend atlas-trend--${direction}`}>
      <span aria-hidden="true">{TREND_ARROW[direction]}</span>
      {text}
    </span>
  );
}
