"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { EnduranceWeeklyVolumePoint } from "@atlas/shared";

type WeeklyVolumeTrendChartProps = {
  weeks: EnduranceWeeklyVolumePoint[];
};

/**
 * Timeline's real "history over time" widget - a chronological weekly-distance trend built from
 * actual synced session history (see apps/api/app/features/endurance/service.py's
 * get_weekly_volume_trend). Deliberately a distinct widget type from Dashboard's current-state
 * hero cards and Capability's per-discipline snapshot: bars over calendar weeks, not a single
 * point-in-time score.
 */
export function WeeklyVolumeTrendChart({ weeks }: WeeklyVolumeTrendChartProps) {
  if (weeks.length === 0) {
    return null;
  }

  const data = weeks.map((week) => ({ ...week, name: week.weekLabel.replace("Week of ", "") }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(31, 36, 33, 0.08)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#61706a", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#61706a", fontSize: 12 }} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(31, 107, 92, 0.06)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(31, 36, 33, 0.12)",
              background: "#fffdf7"
            }}
            formatter={(value, _name, entry) => [
              `${value} km · ${(entry.payload as EnduranceWeeklyVolumePoint).sessionCount} sessions`,
              "Weekly distance"
            ]}
          />
          <Bar dataKey="totalDistanceKm" radius={[8, 8, 0, 0]} maxBarSize={36} fill="#1f6b5c" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
