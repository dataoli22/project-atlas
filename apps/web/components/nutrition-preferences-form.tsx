"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { NutritionMealSlot, NutritionPreferences } from "@atlas/shared";
import { CUISINE_LABELS, CUISINE_ORDER } from "@/lib/cuisine";
import { saveNutritionPreferences } from "@/lib/nutrition-data";

const MEAL_OPTIONS: Array<{ id: NutritionMealSlot; label: string }> = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" }
];

const COOK_TIME_PRESETS = [15, 30, 45, 60];

const HEALTH_CONDITION_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "diabetes", label: "Diabetes" },
  { id: "high_cholesterol", label: "High cholesterol" },
  { id: "hypertension", label: "Hypertension" },
  { id: "celiac_disease", label: "Celiac disease" },
  { id: "ibs", label: "IBS" },
  { id: "kidney_disease", label: "Kidney disease" }
];

const ALLERGEN_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "peanuts", label: "Peanuts" },
  { id: "tree_nuts", label: "Tree nuts" },
  { id: "shellfish", label: "Shellfish" },
  { id: "dairy", label: "Dairy" },
  { id: "gluten", label: "Gluten" },
  { id: "soy", label: "Soy" },
  { id: "eggs", label: "Eggs" },
  { id: "fish", label: "Fish" }
];

type NutritionPreferencesFormProps = {
  initialPreferences: NutritionPreferences;
};

export function NutritionPreferencesForm({ initialPreferences }: NutritionPreferencesFormProps) {
  const router = useRouter();
  const [cuisines, setCuisines] = useState<string[]>(initialPreferences.cuisines);
  const [mealTypes, setMealTypes] = useState<NutritionMealSlot[]>(initialPreferences.mealTypes);
  const [shopFrequency, setShopFrequency] = useState(initialPreferences.shopFrequencyPerWeek);
  const [cookTime, setCookTime] = useState(initialPreferences.avgCookTimeMinutes);
  const [healthConditions, setHealthConditions] = useState<string[]>(initialPreferences.healthConditions);
  const [allergens, setAllergens] = useState<string[]>(initialPreferences.allergens);
  const [planningNote, setPlanningNote] = useState(initialPreferences.planningNote);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleCuisine(cuisine: string) {
    setCuisines((current) =>
      current.includes(cuisine) ? current.filter((entry) => entry !== cuisine) : [...current, cuisine]
    );
  }

  function toggleMeal(meal: NutritionMealSlot) {
    setMealTypes((current) => {
      const next = current.includes(meal) ? current.filter((entry) => entry !== meal) : [...current, meal];
      return next.length === 0 ? current : next;
    });
  }

  function toggleHealthCondition(condition: string) {
    setHealthConditions((current) =>
      current.includes(condition) ? current.filter((entry) => entry !== condition) : [...current, condition]
    );
  }

  function toggleAllergen(allergen: string) {
    setAllergens((current) =>
      current.includes(allergen) ? current.filter((entry) => entry !== allergen) : [...current, allergen]
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveNutritionPreferences({
        cuisines,
        shopFrequencyPerWeek: shopFrequency,
        mealTypes,
        avgCookTimeMinutes: cookTime,
        healthConditions,
        allergens,
        planningNote
      });
      setStatus(
        result.source === "api"
          ? "Saved. Meal selection and allergens now shape the plan and shopping list; other fields are saved for reference."
          : "Backend unavailable - preferences won't be saved until Atlas is reachable again."
      );
      router.refresh();
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Planning preferences</div>
      <p className="atlas-note">
        Pick what actually shapes this week&apos;s plan. Meal selection filters the calendar below in
        real time; cuisine, shop frequency, and cook time are saved with your profile for reference
        (this deterministic planner doesn&apos;t yet regenerate a new blueprint per combination).
      </p>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Cuisines</span>
        <div className="atlas-feature-switcher">
          {CUISINE_ORDER.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              className={cuisines.includes(cuisine) ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => toggleCuisine(cuisine)}
              disabled={isPending}
            >
              {CUISINE_LABELS[cuisine]}
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Meals to plan</span>
        <div className="atlas-feature-switcher">
          {MEAL_OPTIONS.map((meal) => (
            <button
              key={meal.id}
              type="button"
              className={mealTypes.includes(meal.id) ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => toggleMeal(meal.id)}
              disabled={isPending}
            >
              {meal.label}
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Shops per week</span>
        <div className="atlas-feature-switcher">
          {[1, 2, 3, 4, 5, 6, 7].map((count) => (
            <button
              key={count}
              type="button"
              className={shopFrequency === count ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => setShopFrequency(count)}
              disabled={isPending}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Avg. cooking time per day</span>
        <div className="atlas-feature-switcher">
          {COOK_TIME_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={cookTime === minutes ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => setCookTime(minutes)}
              disabled={isPending}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Pre-existing health conditions</span>
        <div className="atlas-feature-switcher">
          {HEALTH_CONDITION_OPTIONS.map((condition) => (
            <button
              key={condition.id}
              type="button"
              className={healthConditions.includes(condition.id) ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => toggleHealthCondition(condition.id)}
              disabled={isPending}
            >
              {condition.label}
            </button>
          ))}
        </div>
        <p className="atlas-note">Saved for reference only - this planner doesn&apos;t yet regenerate meals around a medical condition.</p>
      </div>

      <div className="atlas-stack" style={{ gap: "6px" }}>
        <span className="atlas-form-field__label">Allergens to exclude</span>
        <div className="atlas-feature-switcher">
          {ALLERGEN_OPTIONS.map((allergen) => (
            <button
              key={allergen.id}
              type="button"
              className={allergens.includes(allergen.id) ? "atlas-chip atlas-chip--active" : "atlas-chip"}
              onClick={() => toggleAllergen(allergen.id)}
              disabled={isPending}
            >
              {allergen.label}
            </button>
          ))}
        </div>
        <p className="atlas-note">Real effect: matching ingredients are excluded from the generated shopping list.</p>
      </div>

      <label className="atlas-form-field">
        <span>Tell Atlas what to change this week</span>
        <textarea
          className="atlas-textarea"
          value={planningNote}
          onChange={(event) => setPlanningNote(event.target.value)}
          placeholder='e.g. "I want Japanese cuisine this week"'
          rows={3}
          disabled={isPending}
          maxLength={500}
        />
        <small className="atlas-note" style={{ fontStyle: "italic" }}>
          e.g. &quot;I want Japanese cuisine this week&quot; - saved with your preferences as a note for now.
        </small>
      </label>

      <button type="button" className="atlas-button atlas-button--primary" onClick={save} disabled={isPending}>
        {isPending ? "Saving..." : "Save preferences"}
      </button>
      {status ? <p className="atlas-note">{status}</p> : null}
    </section>
  );
}
