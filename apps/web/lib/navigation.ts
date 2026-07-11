import { FEATURE_DEFINITIONS, type AtlasFeature } from "@atlas/shared";

export type AtlasNavItem = {
  href: string;
  label: string;
  feature: AtlasFeature | "shared";
  shortLabel?: string;
};

export const featureOptions: Array<{
  id: AtlasFeature;
  label: string;
  description: string;
  href: string;
}> = FEATURE_DEFINITIONS.map((feature) => ({
  id: feature.key,
  label: feature.key === "endurance" ? "Endurance" : "Nutrition",
  description:
    feature.key === "endurance"
      ? "Capability, recovery, and event readiness."
      : "Planning, shopping, and cooking flow.",
  href: feature.key === "endurance" ? "/dashboard" : "/planner"
}));

// Nutrition module listed before Endurance module - it's the higher-usage module day to day.
export const navGroups: Array<{
  label: string;
  items: AtlasNavItem[];
}> = [
  {
    label: "Shared shell",
    items: [
      { href: "/", label: "Overview", shortLabel: "Home", feature: "shared" },
      { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", feature: "shared" },
      { href: "/ask", label: "Ask Atlas", shortLabel: "Ask", feature: "shared" },
      { href: "/settings", label: "Settings", shortLabel: "Prefs", feature: "shared" }
    ]
  },
  {
    label: "Nutrition module",
    items: [
      { href: "/onboarding", label: "Onboarding", shortLabel: "Start", feature: "nutrition" },
      { href: "/planner", label: "Planner", shortLabel: "Plan", feature: "nutrition" },
      { href: "/shopping", label: "Shopping", shortLabel: "Shop", feature: "nutrition" },
      { href: "/cooking", label: "Cooking", shortLabel: "Cook", feature: "nutrition" },
      { href: "/nutrition", label: "Nutrition summary", shortLabel: "Macros", feature: "nutrition" }
    ]
  },
  {
    label: "Endurance module",
    items: [
      { href: "/timeline", label: "Timeline", shortLabel: "Timeline", feature: "endurance" },
      { href: "/capability", label: "Capability", shortLabel: "Capability", feature: "endurance" },
      { href: "/log", label: "Daily log", shortLabel: "Log", feature: "endurance" },
      {
        href: "/settings/integrations",
        label: "Integrations",
        shortLabel: "Connect",
        feature: "endurance"
      },
      {
        href: "/settings/tracking",
        label: "Tracking fields",
        shortLabel: "Fields",
        feature: "endurance"
      }
    ]
  }
];

export const mobileNavItems: AtlasNavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", feature: "shared" },
  { href: "/planner", label: "Planner", shortLabel: "Planner", feature: "nutrition" },
  { href: "/timeline", label: "Timeline", shortLabel: "Timeline", feature: "endurance" },
  { href: "/settings", label: "Settings", shortLabel: "Settings", feature: "shared" }
];

export const routeFeatureMap: Record<string, AtlasFeature> = {
  "/dashboard": "endurance",
  "/timeline": "endurance",
  "/capability": "endurance",
  "/log": "endurance",
  "/settings/integrations": "endurance",
  "/settings/tracking": "endurance",
  "/planner": "nutrition",
  "/shopping": "nutrition",
  "/cooking": "nutrition",
  "/nutrition": "nutrition",
  "/onboarding": "nutrition"
};

export function getActiveFeature(pathname: string): AtlasFeature {
  if (pathname.startsWith("/planner") || pathname.startsWith("/shopping") || pathname.startsWith("/cooking")) {
    return "nutrition";
  }

  if (pathname.startsWith("/nutrition") || pathname.startsWith("/onboarding")) {
    return "nutrition";
  }

  if (pathname.startsWith("/timeline") || pathname.startsWith("/capability") || pathname.startsWith("/log")) {
    return "endurance";
  }

  if (pathname.startsWith("/settings/integrations") || pathname.startsWith("/settings/tracking")) {
    return "endurance";
  }

  return "nutrition";
}
