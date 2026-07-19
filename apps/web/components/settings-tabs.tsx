"use client";

import { ClipboardList, LayoutGrid, Link2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/settings", label: "Overview", icon: LayoutGrid },
  { href: "/settings/setup", label: "Setup", icon: ClipboardList },
  { href: "/settings/integrations", label: "Integrations", icon: Link2 }
];

/**
 * Settings is a single tabbed hub - overview, setup/onboarding, integrations, and tracking
 * fields all live under here now instead of being separate top-level nav items. Real navigation
 * (Link, not client-only tab state) so each section stays a real, deep-linkable, server-rendered
 * page - this is just a consistent tab bar shown at the top of all four.
 */
export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="atlas-feature-switcher" aria-label="Settings sections">
      {TABS.map((tab) => {
        const isActive = tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} className={isActive ? "atlas-chip atlas-chip--active" : "atlas-chip"}>
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
