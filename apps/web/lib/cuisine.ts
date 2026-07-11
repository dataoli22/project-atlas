import type { NutritionCuisine } from "@atlas/shared";
import type { MarketCode, MarketOptionData } from "@/lib/settings-data";

// Cuisine is derived 1:1 from the market blueprint that generates the weekly plan (see
// apps/api/app/features/nutrition/service.py's MarketNutritionBlueprint.cuisine) - each market's
// meals are authored in that cuisine's style. "Continental" spans three markets (EU/UK/US); EU
// is the representative pick when a user selects "Continental" from the cuisine switcher.
export const CUISINE_REPRESENTATIVE_MARKET: Record<NutritionCuisine, MarketCode> = {
  indian: "IN",
  japanese: "JP",
  chinese: "CN",
  continental: "EU"
};

export const CUISINE_LABELS: Record<NutritionCuisine, string> = {
  indian: "Indian",
  japanese: "Japanese",
  chinese: "Chinese",
  continental: "Continental"
};

export const CUISINE_ORDER: NutritionCuisine[] = ["indian", "japanese", "chinese", "continental"];

export function marketCodeToCuisine(marketCode: string): NutritionCuisine {
  if (marketCode === "IN") return "indian";
  if (marketCode === "JP") return "japanese";
  if (marketCode === "CN") return "chinese";
  return "continental";
}

export function findMarketForCuisine(
  cuisine: NutritionCuisine,
  markets: MarketOptionData[]
): MarketOptionData | undefined {
  const preferredCode = CUISINE_REPRESENTATIVE_MARKET[cuisine];
  return (
    markets.find((market) => market.code === preferredCode) ??
    markets.find((market) => marketCodeToCuisine(market.code) === cuisine)
  );
}
