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

// Collapsed IA: "Shared shell" is deliberately just Ask Atlas + Settings now - Settings is a
// tabbed hub (see components/settings-tabs.tsx) covering overview, setup/onboarding,
// integrations, and tracking fields, so those don't need separate top-level nav items anymore.
// Nutrition has no separate "Dashboard" nav entry - Planner is the module's landing page and
// absorbed the old /nutrition summary page's unique content (ingredient lookup). /nutrition
// itself now just redirects to /planner so old links/bookmarks keep working.
// Endurance's Dashboard absorbed the Daily log page's "Athlete notes" and an embedded Ask Atlas
// chat, so /log no longer has its own nav entry either - it redirects to /dashboard.
export const navGroups: Array<{
  label: string;
  items: AtlasNavItem[];
}> = [
  {
    label: "Shared shell",
    items: [
      { href: "/ask", label: "Ask Atlas", shortLabel: "Ask", feature: "shared" },
      { href: "/settings", label: "Settings", shortLabel: "Settings", feature: "shared" }
    ]
  },
  {
    label: "Nutrition module",
    items: [
      { href: "/planner", label: "Planner", shortLabel: "Plan", feature: "nutrition" },
      { href: "/shopping", label: "Pantry", shortLabel: "Pantry", feature: "nutrition" },
      { href: "/cooking", label: "Cooking", shortLabel: "Cook", feature: "nutrition" }
    ]
  },
  {
    label: "Endurance module",
    items: [
      { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", feature: "endurance" },
      { href: "/timeline", label: "Timeline", shortLabel: "Timeline", feature: "endurance" },
      { href: "/capability", label: "Capability", shortLabel: "Capability", feature: "endurance" }
    ]
  }
];

export const mobileNavItems: AtlasNavItem[] = [
  { href: "/planner", label: "Nutrition", shortLabel: "Nutri", feature: "nutrition" },
  { href: "/dashboard", label: "Endurance", shortLabel: "Endur", feature: "endurance" },
  { href: "/ask", label: "Ask Atlas", shortLabel: "Ask", feature: "shared" },
  { href: "/settings", label: "Settings", shortLabel: "Settings", feature: "shared" }
];

export const routeFeatureMap: Record<string, AtlasFeature> = {
  "/dashboard": "endurance",
  "/timeline": "endurance",
  "/capability": "endurance",
  "/log": "endurance",
  "/planner": "nutrition",
  "/shopping": "nutrition",
  "/cooking": "nutrition",
  "/nutrition": "nutrition"
};

export function getActiveFeature(pathname: string): AtlasFeature {
  if (pathname.startsWith("/planner") || pathname.startsWith("/shopping") || pathname.startsWith("/cooking")) {
    return "nutrition";
  }

  if (pathname.startsWith("/nutrition")) {
    return "nutrition";
  }

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/timeline") ||
    pathname.startsWith("/capability") ||
    pathname.startsWith("/log")
  ) {
    return "endurance";
  }

  return "nutrition";
}
