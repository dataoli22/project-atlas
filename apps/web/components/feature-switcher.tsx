"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getActiveFeature } from "@/lib/navigation";
import { FEATURE_ICONS } from "@/lib/nav-icons";
import { useShellFeatureState } from "@/lib/shell-preferences";

export function FeatureSwitcher() {
  const pathname = usePathname();
  const routeFeature = getActiveFeature(pathname);
  const { visibleFeatureOptions, activeFeature } = useShellFeatureState();
  const effectiveActiveFeature = visibleFeatureOptions.some((feature) => feature.id === routeFeature)
    ? routeFeature
    : activeFeature;

  return (
    <div className="atlas-feature-switcher" aria-label="Feature switcher">
      {visibleFeatureOptions.map((feature) => {
        const isActive = feature.id === effectiveActiveFeature;
        const Icon = FEATURE_ICONS[feature.id];

        return (
          <Link
            key={feature.id}
            href={feature.href}
            className={isActive ? "atlas-chip atlas-chip--active" : "atlas-chip"}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            <span>{feature.label}</span>
            <span aria-hidden="true">|</span>
            <span>{feature.description}</span>
          </Link>
        );
      })}
    </div>
  );
}
