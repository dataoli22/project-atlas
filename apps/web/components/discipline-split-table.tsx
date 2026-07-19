import type { EnduranceDisciplineKpi } from "@atlas/shared";

type DisciplineSplitTableProps = {
  week: EnduranceDisciplineKpi[];
  month: EnduranceDisciplineKpi[];
  hasRealSessions: boolean;
};

const DISCIPLINE_LABEL: Record<string, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  other: "Other"
};

/**
 * Capability's real "current strengths by discipline" widget - a compact table comparing real
 * synced run/bike/swim totals over the last 7 and 30 days (see apps/api/app/features/endurance/
 * service.py's _group_by_discipline). A discipline with zero real sessions in a window is simply
 * absent from that window's rows, not shown as a fabricated zero. Deliberately a table, not
 * another bar chart, so this reads as distinct from the capability score bars above it and from
 * Timeline's weekly-volume bar chart.
 */
export function DisciplineSplitTable({ week, month, hasRealSessions }: DisciplineSplitTableProps) {
  if (!hasRealSessions) {
    return (
      <p className="atlas-note">
        No synced sessions yet, so there is no real discipline split to show. Connect Strava or
        Health Connect in Settings to start seeing run/bike/swim totals here.
      </p>
    );
  }

  const disciplines = Array.from(new Set([...week.map((row) => row.discipline), ...month.map((row) => row.discipline)]));
  const weekByDiscipline = new Map(week.map((row) => [row.discipline, row]));
  const monthByDiscipline = new Map(month.map((row) => [row.discipline, row]));

  return (
    <div className="atlas-table-scroll">
      <table className="atlas-table">
        <thead>
          <tr>
            <th>Discipline</th>
            <th>7-day distance</th>
            <th>7-day time</th>
            <th>30-day distance</th>
            <th>30-day time</th>
          </tr>
        </thead>
        <tbody>
          {disciplines.map((discipline) => {
            const weekRow = weekByDiscipline.get(discipline);
            const monthRow = monthByDiscipline.get(discipline);
            return (
              <tr key={discipline}>
                <td>{DISCIPLINE_LABEL[discipline] ?? discipline}</td>
                <td>{weekRow ? `${weekRow.totalDistanceKm} km` : "-"}</td>
                <td>{weekRow ? `${Math.round(weekRow.totalDurationMinutes)} min` : "-"}</td>
                <td>{monthRow ? `${monthRow.totalDistanceKm} km` : "-"}</td>
                <td>{monthRow ? `${Math.round(monthRow.totalDurationMinutes)} min` : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
