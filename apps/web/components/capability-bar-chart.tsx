"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CapabilityBarChartProps = {
  areas: Array<{ label: string; score: number; direction: string }>;
};

const BAR_COLOR_BY_SCORE = (score: number) => {
  if (score >= 75) return "#1f6b5c";
  if (score >= 50) return "#3f8f7d";
  return "#c7693d";
};

export function CapabilityBarChart({ areas }: CapabilityBarChartProps) {
  const data = areas.map((area) => ({ ...area, name: area.label }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="rgba(31, 36, 33, 0.08)" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#61706a", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(31, 107, 92, 0.06)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(31, 36, 33, 0.12)",
              background: "#fffdf7"
            }}
            formatter={(value, _name, entry) => [
              `${value} · ${(entry.payload as { direction: string }).direction}`,
              "Score"
            ]}
          />
          <Bar dataKey="score" radius={[0, 8, 8, 0]} maxBarSize={22}>
            {data.map((area) => (
              <Cell key={area.label} fill={BAR_COLOR_BY_SCORE(area.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
