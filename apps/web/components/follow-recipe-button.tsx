"use client";

import { useState, useTransition } from "react";

import { searchRecipes, type RecipeSearchHit } from "@/lib/nutrition-data";

/**
 * On-demand "Follow recipe" action for a single meal/dish name. Deliberately does NOT
 * auto-fire on mount - the recipe search endpoint is rate-limited to 5/day, and a 7-day plan
 * with 2-3 meals/day would burn the whole daily quota instantly if every meal searched on
 * page load. Instead this only calls the real search endpoint when the user clicks, and
 * surfaces the first real result's real URL (no fabricated recipe links).
 */
export function FollowRecipeButton({ dishName }: { dishName: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "pending" }
    | { status: "found"; hit: RecipeSearchHit }
    | { status: "empty" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function runSearch() {
    startTransition(async () => {
      setState({ status: "pending" });
      const result = await searchRecipes(dishName);
      if (!result.ok) {
        setState({ status: "error", message: result.message });
        return;
      }
      if (result.results.length === 0) {
        setState({ status: "empty" });
        return;
      }
      setState({ status: "found", hit: result.results[0] });
    });
  }

  if (state.status === "found") {
    return (
      <a href={state.hit.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem" }}>
        Follow recipe →
      </a>
    );
  }

  // Real search is exhausted (rate limit), errored, or found nothing - fall back to a plain
  // constructed web-search URL. This is NOT presented as a matched recipe result: it's labeled
  // as a web-search fallback so it's honest about being unmatched, but it's a real, always
  // available link (no API call, no rate limit) so the user isn't left with a dead end.
  const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(`${dishName} recipe`)}`;

  return (
    <div>
      <button
        type="button"
        className="atlas-button atlas-button--secondary"
        style={{ fontSize: "0.8rem", padding: "2px 8px" }}
        onClick={runSearch}
        disabled={isPending}
      >
        {isPending || state.status === "pending" ? "Searching..." : "Follow recipe"}
      </button>
      {state.status === "empty" ? (
        <div className="atlas-note" style={{ fontSize: "0.78rem" }}>
          No recipe found for &quot;{dishName}&quot;.
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="atlas-note" style={{ fontSize: "0.78rem", color: "var(--atlas-warm)" }}>
          {state.message}
        </div>
      ) : null}
      {state.status === "empty" || state.status === "error" ? (
        <a href={fallbackUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem" }}>
          Search the web for this recipe →
        </a>
      ) : null}
    </div>
  );
}
