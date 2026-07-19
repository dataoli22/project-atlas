import type { EnduranceTrainingPlanData } from "@atlas/shared";

type EnduranceTrainingPlanProps = {
  plan: EnduranceTrainingPlanData;
};

/**
 * Displays the deterministic, rules-based weekly training plan (see
 * apps/api/app/features/endurance/service.py's generate_training_plan docstring for the "10%
 * rule" heuristic it applies). This is the Dashboard's "planning/goals" widget - a forward-
 * looking weekly structure, distinct from Timeline's backward-looking weekly-volume history and
 * Capability's current-strengths discipline breakdown.
 */
export function EnduranceTrainingPlan({ plan }: EnduranceTrainingPlanProps) {
  if (!plan.hasGoal || !plan.goal) {
    return (
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Training plan</div>
        <p className="atlas-note">
          Set a goal above to generate a deterministic weekly training plan based on your real
          recent training volume.
        </p>
      </section>
    );
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Training plan</div>
      <p className="atlas-note">{plan.methodologyNote}</p>
      <dl className="atlas-detail-list">
        <div className="atlas-detail-list__row">
          <dt>Recent weekly distance</dt>
          <dd>{plan.baselineWeeklyDistanceKm} km/week</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Goal</dt>
          <dd>
            {plan.goal.goalType.replace(/_/g, " ")} - {plan.goal.targetDistanceKm} km
            {plan.goal.targetDate ? ` by ${plan.goal.targetDate}` : ""}
          </dd>
        </div>
      </dl>

      {plan.sessionsByDiscipline.length > 0 ? (
        <div className="atlas-stack" style={{ gap: "6px" }}>
          <span className="atlas-form-field__label">Weekly session structure</span>
          <div className="atlas-badge-row">
            {plan.sessionsByDiscipline.map((session) => (
              <span key={session.discipline} className="atlas-badge atlas-badge--earned">
                <span className="atlas-badge__dot" />
                {session.sessionsPerWeek}x {session.discipline}: {session.focus}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="atlas-timeline">
        {plan.weeks.map((week) => (
          <div key={week.weekNumber} className="atlas-timeline__entry">
            <div className="atlas-list-card__title">
              {week.label}: {week.totalDistanceKm} km total, {week.longSessionDistanceKm} km long session
            </div>
            <div className="atlas-list-card__meta">{week.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
