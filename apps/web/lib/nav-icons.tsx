import {
  Activity,
  CalendarRange,
  ChefHat,
  ClipboardList,
  Gauge,
  Home,
  LayoutDashboard,
  Link2,
  MessageCircle,
  NotebookPen,
  Salad,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  type LucideIcon
} from "lucide-react";

// Icons from lucide-react (ISC license, open source) - one lookup keyed by route so every nav
// surface (sidebar, mobile nav, feature switcher) stays visually consistent without redefining
// the mapping three times.
export const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/ask": MessageCircle,
  "/settings": Settings,
  "/settings/setup": ClipboardList,
  "/planner": CalendarRange,
  "/shopping": ShoppingCart,
  "/cooking": ChefHat,
  "/nutrition": Salad,
  "/timeline": Activity,
  "/capability": Gauge,
  "/log": NotebookPen,
  "/settings/integrations": Link2,
  "/settings/tracking": SlidersHorizontal
};

export function getRouteIcon(href: string): LucideIcon {
  return ROUTE_ICONS[href] ?? Home;
}

export const FEATURE_ICONS: Record<"endurance" | "nutrition", LucideIcon> = {
  endurance: Activity,
  nutrition: Salad
};
