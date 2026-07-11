"use client";

import { useState } from "react";

import type { NutritionCalendarDay, NutritionMealSlot } from "@atlas/shared";
import { COOK_TIME_BUCKETS, matchesCookTimeBucket, type CookTimeBucket } from "@/lib/cook-time";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CalendarDayCard({ day }: { day: NutritionCalendarDay }) {
  return (
    <div
      className="atlas-list-card"
      style={{
        borderColor: day.isBatchDay ? "var(--atlas-accent)" : undefined,
        minWidth: "180px"
      }}
    >
      <div className="atlas-list-card__title">
        {day.dayLabel} | {formatDate(day.date)}
        {day.isBatchDay ? " | Batch day" : ""}
      </div>
      <div className="atlas-stack" style={{ gap: "4px", marginTop: "6px" }}>
        {day.meals.map((meal: { slot: NutritionMealSlot; title: string; isLeftover: boolean; carryoverFrom?: string | null }) => (
          <div key={meal.slot} className="atlas-list-card__meta">
            <strong style={{ textTransform: "capitalize" }}>{meal.slot}:</strong> {meal.title}
            {meal.isLeftover ? ` (leftover${meal.carryoverFrom ? ` from ${meal.carryoverFrom}` : ""})` : ""}
          </div>
        ))}
      </div>
      <div className="atlas-list-card__meta" style={{ marginTop: "6px" }}>
        {day.cookTimeMinutes} min cook
        {day.leftoverInto ? ` -> carries into ${day.leftoverInto}` : ""}
      </div>
      {day.prepWindow ? <div className="atlas-list-card__meta">Prep window: {day.prepWindow}</div> : null}
    </div>
  );
}

export function CalendarTimeFilter({ calendarDays }: { calendarDays: NutritionCalendarDay[] }) {
  const [activeBucket, setActiveBucket] = useState<CookTimeBucket | "all">("all");

  const visibleDays =
    activeBucket === "all"
      ? calendarDays
      : calendarDays.filter((day) => matchesCookTimeBucket(day.cookTimeMinutes, activeBucket));

  return (
    <div className="atlas-stack" style={{ gap: "12px" }}>
      <div className="atlas-stack" style={{ gap: "8px" }}>
        <div className="atlas-panel__eyebrow">Time to cook</div>
        <div className="atlas-feature-switcher">
          <button
            type="button"
            className={activeBucket === "all" ? "atlas-chip atlas-chip--active" : "atlas-chip"}
            onClick={() => setActiveBucket("all")}
          >
            All
          </button>
          {COOK_TIME_BUCKETS.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              className={activeBucket === bucket.id ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => setActiveBucket(bucket.id)}
            >
              {bucket.label}
            </button>
          ))}
        </div>
      </div>

      {visibleDays.length === 0 ? (
        <p className="atlas-note">No days in this week&apos;s plan fall into that cook-time range.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            overflowX: "auto"
          }}
        >
          {visibleDays.map((day) => (
            <CalendarDayCard key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
