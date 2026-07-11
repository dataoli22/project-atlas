"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { NutritionCuisine } from "@atlas/shared";
import { CUISINE_LABELS, CUISINE_ORDER, findMarketForCuisine, marketCodeToCuisine } from "@/lib/cuisine";
import { buildLocaleTag } from "@/lib/localization";
import type { LocalizationSettingsData, MarketOptionData } from "@/lib/settings-data";
import { saveLocalizationSettings } from "@/lib/settings-data";

type CuisineSwitcherProps = {
  localization: LocalizationSettingsData;
  markets: MarketOptionData[];
};

export function CuisineSwitcher({ localization, markets }: CuisineSwitcherProps) {
  const router = useRouter();
  const [activeCuisine, setActiveCuisine] = useState<NutritionCuisine>(marketCodeToCuisine(localization.market));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function selectCuisine(cuisine: NutritionCuisine) {
    if (cuisine === activeCuisine || isPending) {
      return;
    }

    const market = findMarketForCuisine(cuisine, markets);
    if (!market) {
      setStatus(`No market maps to ${CUISINE_LABELS[cuisine]} cuisine yet.`);
      return;
    }

    startTransition(async () => {
      const result = await saveLocalizationSettings({
        market: market.code,
        currency: market.defaultCurrency,
        language: market.defaultLanguage,
        locale: buildLocaleTag(market.defaultLanguage, market.code),
        supportedLanguages: market.supportedLanguages,
        currencyOverride: false,
        languageOverride: false
      });

      setActiveCuisine(cuisine);
      setStatus(
        result.source === "api"
          ? `Switched to ${CUISINE_LABELS[cuisine]} - regenerating this week's plan.`
          : "Local API unavailable, so the cuisine switch didn't save."
      );
      router.refresh();
    });
  }

  return (
    <div className="atlas-stack" style={{ gap: "8px" }}>
      <div className="atlas-panel__eyebrow">Cuisine</div>
      <div className="atlas-feature-switcher">
        {CUISINE_ORDER.map((cuisine) => (
          <button
            key={cuisine}
            type="button"
            className={cuisine === activeCuisine ? "atlas-chip atlas-chip--active" : "atlas-chip"}
            onClick={() => selectCuisine(cuisine)}
            disabled={isPending}
          >
            {CUISINE_LABELS[cuisine]}
          </button>
        ))}
      </div>
      {status ? <p className="atlas-note">{status}</p> : null}
    </div>
  );
}
