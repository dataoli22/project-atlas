"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EnduranceGoal, EnduranceGoalType } from "@atlas/shared";
import { saveEnduranceGoal } from "@/lib/endurance-data";

const GOAL_OPTIONS: Array<{ id: EnduranceGoalType; label: string; defaultDistanceKm: number }> = [
  { id: "5k_run", label: "5K run", defaultDistanceKm: 5 },
  { id: "10k_run", label: "10K run", defaultDistanceKm: 10 },
  { id: "half_marathon", label: "Half marathon", defaultDistanceKm: 21.1 },
  { id: "marathon", label: "Marathon", defaultDistanceKm: 42.2 },
  { id: "sprint_triathlon", label: "Sprint triathlon", defaultDistanceKm: 25.75 },
  { id: "olympic_triathlon", label: "Olympic triathlon", defaultDistanceKm: 51.5 },
  { id: "half_ironman_triathlon", label: "Half Ironman", defaultDistanceKm: 113 },
  { id: "ironman_triathlon", label: "Ironman", defaultDistanceKm: 226 },
  { id: "custom", label: "Custom", defaultDistanceKm: 10 }
];

type EnduranceGoalFormProps = {
  initialGoal: EnduranceGoal;
};

export function EnduranceGoalForm({ initialGoal }: EnduranceGoalFormProps) {
  const router = useRouter();
  const [goalType, setGoalType] = useState<EnduranceGoalType>(
    (initialGoal.goalType || "5k_run") as EnduranceGoalType
  );
  const [distanceKm, setDistanceKm] = useState(initialGoal.targetDistanceKm || 5);
  const [timeMinutes, setTimeMinutes] = useState<string>(
    initialGoal.targetTimeMinutes ? String(initialGoal.targetTimeMinutes) : ""
  );
  const [targetDate, setTargetDate] = useState(initialGoal.targetDate ?? "");
  const [note, setNote] = useState(initialGoal.note ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectGoal(option: (typeof GOAL_OPTIONS)[number]) {
    setGoalType(option.id);
    setDistanceKm(option.defaultDistanceKm);
  }

  function save() {
    startTransition(async () => {
      const result = await saveEnduranceGoal({
        goalType,
        targetDistanceKm: distanceKm,
        targetTimeMinutes: timeMinutes ? Number(timeMinutes) : null,
        targetDate: targetDate || null,
        note
      });
      setStatus(
        result.source === "api"
          ? "Saved. The training plan below now targets this goal."
          : "Backend unavailable - the goal won't be saved until Atlas is reachable again."
      );
      router.refresh();
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Set your goal</div>
      <p className="atlas-note">
        Pick a real target (distance and, optionally, a goal time and date). This drives the
        deterministic training plan below - it is saved to your profile the same way nutrition
        preferences are.
      </p>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Goal type</span>
        <div className="atlas-feature-switcher">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={goalType === option.id ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => selectGoal(option)}
              disabled={isPending}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="atlas-form-field">
        <span>Target distance (km)</span>
        <input
          type="number"
          min={0.1}
          max={500}
          step={0.05}
          value={distanceKm}
          onChange={(event) => setDistanceKm(Number(event.target.value))}
          disabled={isPending}
        />
      </label>

      <label className="atlas-form-field">
        <span>Target time (minutes, optional)</span>
        <input
          type="number"
          min={1}
          max={10000}
          value={timeMinutes}
          onChange={(event) => setTimeMinutes(event.target.value)}
          placeholder="e.g. 90"
          disabled={isPending}
        />
      </label>

      <label className="atlas-form-field">
        <span>Target date (optional)</span>
        <input
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="atlas-form-field">
        <span>Note (optional)</span>
        <input
          type="text"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. First triathlon"
          disabled={isPending}
        />
      </label>

      <button type="button" className="atlas-button atlas-button--primary" onClick={save} disabled={isPending}>
        {isPending ? "Saving..." : "Save goal"}
      </button>
      {status ? <p className="atlas-note">{status}</p> : null}
    </section>
  );
}
