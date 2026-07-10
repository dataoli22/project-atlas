import type { ReactNode } from "react";
import Link from "next/link";

import { AppLockGate } from "@/components/app-lock-gate";
import { AppVersionFooter } from "@/components/app-version-footer";
import { FeatureSwitcher } from "@/components/feature-switcher";
import { ShellMobileNav, ShellSidebar } from "@/components/shell-nav";
import { getAppLockSettingsData } from "@/lib/app-lock-data";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const appLock = await getAppLockSettingsData();

  return (
    <AppLockGate initialLockSettings={appLock.data}>
      <div className="atlas-shell">
        <div className="atlas-shell__inner">
          <header className="atlas-header">
            <div className="atlas-brand">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="atlas-brand__mark">AT</span>
                <div>
                  <div className="atlas-brand__eyebrow">Project Atlas</div>
                  <h1 className="atlas-brand__title">Shared health shell for two focused workspaces</h1>
                  <p className="atlas-brand__summary">
                    One account, one navigation shell, one feature switcher. Endurance and Nutrition stay modular
                    without feeling like separate apps.
                  </p>
                </div>
              </div>
              <Link href="/settings" className="atlas-chip">
                Global settings
              </Link>
            </div>
            <FeatureSwitcher />
          </header>

          <div className="atlas-layout">
            <ShellSidebar />
            <main className="atlas-content">{children}</main>
          </div>

          <ShellMobileNav />
          <AppVersionFooter />
        </div>
      </div>
    </AppLockGate>
  );
}
