"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useShellFeatureState } from "@/lib/shell-preferences";

function isActiveLink(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function ShellSidebar() {
  const pathname = usePathname();
  const { visibleNavGroups } = useShellFeatureState();

  return (
    <aside className="atlas-sidebar" aria-label="Desktop navigation">
      <div className="atlas-section-nav">
        {visibleNavGroups.map((group) => (
          <section key={group.label} className="atlas-section-nav__group">
            <div className="atlas-section-nav__label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActiveLink(pathname, item.href) ? "atlas-nav-link atlas-nav-link--active" : "atlas-nav-link"}
              >
                <span>{item.label}</span>
                <span aria-hidden="true">{item.feature === "shared" ? "Atlas" : item.feature}</span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

export function ShellMobileNav() {
  const pathname = usePathname();
  const { visibleMobileNavItems } = useShellFeatureState();

  return (
    <nav className="atlas-mobile-nav" aria-label="Mobile navigation">
      {visibleMobileNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            isActiveLink(pathname, item.href)
              ? "atlas-mobile-nav__link atlas-mobile-nav__link--active"
              : "atlas-mobile-nav__link"
          }
        >
          <span>{item.shortLabel ?? item.label}</span>
          <span aria-hidden="true">{item.feature === "shared" ? "*" : item.feature === "endurance" ? "E" : "N"}</span>
        </Link>
      ))}
    </nav>
  );
}
