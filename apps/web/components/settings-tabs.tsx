"use client";

import { ClipboardList, LayoutGrid, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/settings", label: "Overview", icon: LayoutGrid },
  { href: "/settings/setup", label: "Setup", icon: ClipboardList }
];

/**
 * Settings is a single tabbed hub - overview and setup live under here instead of being separate
 * top-level nav items. Integrations used to be its own tab, but every connector's live UI (health
 * apps, device pairing, AI, web search) now lives inside Setup's module menu, so there's nothing
 * left for a separate Integrations page to own. Real navigation (Link, not client-only tab state)
 * so each section stays a real, deep-linkable, server-rendered page.
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
