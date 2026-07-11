"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const STATE_LABEL: Record<AtlasUpdateState, string> = {
  idle: "Not checked yet",
  checking: "Checking for updates...",
  "up-to-date": "Up to date",
  downloading: "Downloading update...",
  downloaded: "Update ready to install",
  error: "Update check failed",
  unsupported: "Not available in this environment"
};

function formatCheckedAt(iso?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Only functional inside the packaged Electron desktop app (window.atlasDesktop is undefined in
 * the regular browser deployment, including npm run dev:web) - electron-updater only runs when
 * app.isPackaged. Shows a plain explanatory note outside that context instead of pretending to
 * check for updates.
 */
export function UpdatesPanel() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<AtlasUpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.atlasDesktop : undefined;
    if (!bridge?.updates) {
      return;
    }
    setIsDesktop(true);
    bridge.updates.getStatus().then(setStatus);
    const unsubscribe = bridge.updates.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  if (!isDesktop) {
    return (
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Updates</div>
        <p className="atlas-note">
          Auto-update is only available inside the installed Atlas desktop app, not this browser
          preview. The desktop app checks GitHub Releases on launch and every 4 hours, downloads a
          newer version in the background, and prompts you to restart once it&apos;s ready.
        </p>
      </section>
    );
  }

  async function checkNow() {
    const bridge = window.atlasDesktop;
    if (!bridge?.updates) return;
    setIsChecking(true);
    const result = await bridge.updates.check();
    setStatus(result);
    setIsChecking(false);
  }

  function installNow() {
    window.atlasDesktop?.updates.install();
  }

  const state = status?.state ?? "idle";
  const checkedAt = formatCheckedAt(status?.lastCheckedAt);

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Updates</div>
      <p className="atlas-note">
        Atlas is open source and updates fairly often. This checks GitHub Releases directly from
        your device - never through a hosted relay - and only downloads what you approve via the
        restart prompt.
      </p>

      <div className="atlas-stat-grid">
        <div className="atlas-stat">
          <div className="atlas-stat__label">Installed version</div>
          <div className="atlas-stat__value">{status?.currentVersion ?? "-"}</div>
        </div>
        <div className="atlas-stat">
          <div className="atlas-stat__label">Status</div>
          <div className="atlas-stat__value" style={{ fontSize: "1rem" }}>
            {STATE_LABEL[state]}
          </div>
        </div>
        {status?.latestVersion ? (
          <div className="atlas-stat">
            <div className="atlas-stat__label">Latest seen</div>
            <div className="atlas-stat__value">{status.latestVersion}</div>
          </div>
        ) : null}
      </div>

      {state === "downloading" && typeof status?.progressPercent === "number" ? (
        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "rgba(31, 107, 92, 0.12)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: `${status.progressPercent}%`,
              height: "100%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, var(--atlas-accent), var(--atlas-warm))",
              transition: "width 300ms ease"
            }}
          />
        </div>
      ) : null}

      {state === "error" && status?.error ? (
        <p className="atlas-note" style={{ color: "var(--atlas-danger)" }}>
          {status.error}
        </p>
      ) : null}

      {checkedAt ? <p className="atlas-note">Last checked: {checkedAt}</p> : null}

      <div className="atlas-control-card__actions">
        {state === "downloaded" ? (
          <button type="button" className="atlas-button atlas-button--primary" onClick={installNow}>
            Restart and install now
          </button>
        ) : (
          <button
            type="button"
            className="atlas-button atlas-button--secondary"
            onClick={checkNow}
            disabled={isChecking || state === "checking" || state === "downloading"}
          >
            <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
            {isChecking || state === "checking" ? "Checking..." : "Check for updates"}
          </button>
        )}
      </div>
    </section>
  );
}
