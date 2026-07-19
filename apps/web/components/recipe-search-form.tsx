"use client";

import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import { searchRecipes, swapNutritionMeal, type RecipeSearchHit } from "@/lib/nutrition-data";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS: Array<{ value: string; label: string }> = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" }
];

export function RecipeSearchForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSearchHit[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [day, setDay] = useState("Mon");
  const [slot, setSlot] = useState("dinner");
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSearchPending, startSearchTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const [syncingUrl, setSyncingUrl] = useState<string | null>(null);

  function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    startSearchTransition(async () => {
      setStatus(null);
      setIsError(false);
      const result = await searchRecipes(trimmed);
      if (!result.ok) {
        setIsError(true);
        setStatus(result.message);
        return;
      }
      setResults(result.results);
      setRemaining(result.searchesRemainingToday);
      if (result.results.length === 0) {
        setStatus("No recipes found for that search.");
      }
    });
  }

  function syncToPlan(hit: RecipeSearchHit) {
    setSyncingUrl(hit.url);
    startSyncTransition(async () => {
      const result = await swapNutritionMeal(day, slot, hit.title, `Synced from recipe search: ${hit.url}`);
      setIsError(!result.ok);
      setStatus(
        result.ok
          ? `"${hit.title}" is now ${day} ${slot} - cooking plan and shopping list update automatically.`
          : result.message
      );
      setSyncingUrl(null);
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div
        className="atlas-panel__eyebrow"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        Find your own recipe
        <HintTooltip label="Before this works">
          Needs a Brave Search key set under Settings → Integrations. Without one, searches will
          fail - this is a real web search, not example data.
        </HintTooltip>
      </div>
      <p className="atlas-note">
        Search for a recipe you actually want to cook, then sync it straight into your plan - the
        cooking steps, shopping list, and pantry view all update from it automatically.
        {remaining !== null ? ` ${remaining} searches left today.` : " Limited to 5 searches a day."}
      </p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Recipe search</span>
          <input
            type="text"
            placeholder="e.g. chicken shawarma bowl"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                runSearch();
              }
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="atlas-button atlas-button--primary"
        onClick={runSearch}
        disabled={isSearchPending || !query.trim()}
      >
        {isSearchPending ? "Searching..." : "Search"}
      </button>

      {results.length > 0 ? (
        <>
          <div className="atlas-form-grid">
            <label className="atlas-form-field">
              <span>Day to replace</span>
              <select value={day} onChange={(event) => setDay(event.target.value)}>
                {DAYS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="atlas-form-field">
              <span>Meal slot</span>
              <select value={slot} onChange={(event) => setSlot(event.target.value)}>
                {SLOTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="atlas-stack">
            {results.map((hit) => (
              <div key={hit.url} className="atlas-list-card">
                <div className="atlas-list-card__title">{hit.title}</div>
                <div className="atlas-list-card__meta">{hit.snippet}</div>
                <div className="atlas-control-card__actions">
                  <a className="atlas-note" href={hit.url} target="_blank" rel="noreferrer">
                    View recipe
                  </a>
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary"
                    onClick={() => syncToPlan(hit)}
                    disabled={isSyncPending}
                  >
                    {isSyncPending && syncingUrl === hit.url ? "Syncing..." : `Sync to ${day} ${slot}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {status ? (
        <p className="atlas-note" style={isError ? { color: "var(--atlas-warm)" } : undefined}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
