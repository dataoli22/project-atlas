"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";

import { HintTooltip } from "@/components/hint-tooltip";
import type { PairedDeviceData, PairingStartData } from "@/lib/pairing-data";
import { revokeDevice, startPairing } from "@/lib/pairing-data";

// Where a phone lands if it scans the QR without the Atlas Companion app installed yet (the
// intent:// URI's browser_fallback_url, below). Points at GitHub Releases rather than a page
// served by this desktop over LAN, since GitHub is reachable from any network the phone has
// data/Wi-Fi on - a locally-served fallback would only work if the phone happens to already be on
// the same LAN as the desktop, which is often true but not guaranteed at scan time.
//
// Filtered to "Atlas Companion" (the mobile release workflow's release title, see
// .github/workflows/android-release.yml) rather than plain /releases/latest: this repo also
// publishes desktop installer releases to the same Releases list under different tags, and
// /releases/latest resolves to whichever was published most recently, desktop or mobile - a user
// scanning this QR could land on a Windows .exe instead of the Android APK. The query filter
// keeps the fallback page scoped to companion-app releases only.
const COMPANION_APK_RELEASES_URL = "https://github.com/dataoli22/project-atlas/releases?q=Atlas+Companion&expanded=true";

/**
 * Builds the Android "intent://" URI a QR code scan opens: if the Atlas Companion app
 * (com.projectatlas.mobile) is installed, it launches directly into MainActivity's atlas://pair
 * deep link (AndroidManifest.xml's atlas/pair intent-filter) with the pairing details pre-filled;
 * if not installed, Chrome falls back to browser_fallback_url so the user can grab the APK, then
 * re-scan (or the app deep-links automatically next time since the intent persists in the QR).
 * This is the standard Chrome-documented pattern for "open app or fall back to install", not a
 * custom scheme that would just fail silently with no app found.
 */
function buildPairingQrPayload(host: string, port: number, code: string): string {
  const params = new URLSearchParams({ host, port: String(port), code });
  return `intent://pair?${params.toString()}#Intent;scheme=atlas;package=com.projectatlas.mobile;S.browser_fallback_url=${encodeURIComponent(COMPANION_APK_RELEASES_URL)};end`;
}

type PairingSettingsFormProps = {
  initialDevices: PairedDeviceData[];
  devicesLoadOk: boolean;
};

export function PairingSettingsForm({ initialDevices, devicesLoadOk }: PairingSettingsFormProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [pairingCode, setPairingCode] = useState<PairingStartData | null>(null);
  const [status, setStatus] = useState(
    devicesLoadOk
      ? "No phone paired yet."
      : "Atlas could not reach the local backend to load paired devices."
  );
  const [isStarting, startPairTransition] = useTransition();
  const [isRevoking, startRevokeTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pairingCode || pairingCode.lanAddresses.length === 0) {
      setQrDataUrl(null);
      return;
    }
    const payload = buildPairingQrPayload(pairingCode.lanAddresses[0], pairingCode.port, pairingCode.code);
    QRCode.toDataURL(payload, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [pairingCode]);

  function beginPairing() {
    startPairTransition(async () => {
      const result = await startPairing();
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      setPairingCode(result.data);
      setStatus(
        result.data.lanAddresses.length > 0
          ? "Enter this address and code in the Atlas Companion app on your phone within 5 minutes."
          : "No local network address was detected. Confirm this device is connected to Wi-Fi, not only loopback."
      );
    });
  }

  function revoke(deviceId: string) {
    startRevokeTransition(async () => {
      const result = await revokeDevice(deviceId);
      if (result === null) {
        setStatus("Could not revoke that device. The local backend was unreachable.");
        return;
      }
      setDevices(result);
      setStatus("Device unpaired.");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div
        className="atlas-panel__eyebrow"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        Phone pairing
        <HintTooltip label="Why pair a phone">
          Health Connect and Samsung Health only exist on your phone, not this device. Pairing lets
          the Atlas Companion phone app send that data here - hydration, steps, sleep, and more.
        </HintTooltip>
      </div>
      <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
        In development: pairing itself is functional, but the device-side code that reads Health
        Connect and Samsung Health has not yet been built or tested on hardware, so a paired
        phone may not have data to sync.
      </p>

      <div className="atlas-list-card">
        <div className="atlas-list-card__title">Before you start</div>
        <ol style={{ margin: "8px 0 0", paddingLeft: "20px", display: "grid", gap: "6px" }}>
          <li className="atlas-note">
            Connect your phone to the <strong>same Wi-Fi network</strong> as this computer. Phone
            pairing only works over the local network - it will not work on mobile data or a
            different Wi-Fi network.
          </li>
          <li className="atlas-note">
            Turn on <strong>&quot;Allow phone pairing on this network&quot;</strong> below.
          </li>
          <li className="atlas-note">
            Tap <strong>&quot;Start pairing a phone&quot;</strong>, then scan the QR code with your
            phone&apos;s camera. If the Atlas Companion app isn&apos;t installed yet, this downloads
            it - Android will ask you to confirm &quot;install from unknown sources&quot; once,
            since it isn&apos;t distributed through the Play Store. Approve that, install the app,
            then scan the same QR code again to open it directly into pairing.
          </li>
        </ol>
        <p className="atlas-note" style={{ marginTop: "8px" }}>
          No developer options or wireless debugging needed for this path - that&apos;s only for
          the advanced install method below.
        </p>
      </div>

      <LanPairingToggle />

      <div className="atlas-stack">
        {devices.length === 0 ? (
          <p className="atlas-placeholder">No devices paired.</p>
        ) : (
          devices.map((device) => (
            <div key={device.deviceId} className="atlas-list-card">
              <div className="atlas-list-card__title">{device.deviceName}</div>
              <div className="atlas-list-card__meta">Paired {device.pairedAt}</div>
              <div className="atlas-list-card__meta">Last sync: {device.lastSyncAt ?? "Never"}</div>
              <button
                type="button"
                className="atlas-button atlas-button--secondary"
                onClick={() => revoke(device.deviceId)}
                disabled={isRevoking}
              >
                Unpair
              </button>
            </div>
          ))
        )}
      </div>

      {pairingCode ? (
        <div className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Pairing code: {pairingCode.code}</div>
            <div className="atlas-control-card__meta">
              Address: {pairingCode.lanAddresses.length > 0 ? pairingCode.lanAddresses.join(" or ") : "unavailable"}
              :{pairingCode.port}
            </div>
            <div className="atlas-control-card__meta">Expires {pairingCode.expiresAt}</div>
            {qrDataUrl ? (
              <div className="atlas-control-card__meta">
                <img src={qrDataUrl} alt="Scan with your phone's camera to pair" width={220} height={220} />
                <p className="atlas-note">
                  Scan with your phone&apos;s camera app (not from inside Atlas Companion). Already
                  installed: opens straight into pairing with this code filled in. Not installed
                  yet: takes you to the download page - install the app, then scan this same code
                  again.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button type="button" className="atlas-button atlas-button--primary" onClick={beginPairing} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start pairing a phone"}
      </button>

      <p className="atlas-note">{status}</p>

      <details>
        <summary className="atlas-note" style={{ cursor: "pointer" }}>
          For developers: install via ADB instead of the QR code
        </summary>
        <div className="atlas-stack" style={{ marginTop: "10px" }}>
          <p className="atlas-note">
            Skips the in-app download page - installs the debug or downloaded release APK directly
            from a computer with{" "}
            <a href="https://developer.android.com/tools/adb" target="_blank" rel="noreferrer">
              adb
            </a>{" "}
            on its PATH.
          </p>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">USB</div>
            <pre className="atlas-code-block">
              <code>adb install -r app-debug.apk</code>
            </pre>
          </div>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">Wireless (Android 11+, no cable)</div>
            <p className="atlas-note">
              On the phone: Settings → Developer options → Wireless debugging → Pair device with
              pairing code. Then, on the computer:
            </p>
            <pre className="atlas-code-block">
              <code>{`adb pair <phone-ip>:<pairing-port>   # enter the 6-digit code shown on the phone
adb connect <phone-ip>:<debugging-port>
adb install -r app-debug.apk`}</code>
            </pre>
          </div>
          <p className="atlas-note">
            This is the same debug APK produced by <code>./gradlew assembleDebug</code> (see{" "}
            <code>docs/user-guides/android-install.md</code>), or a signed release APK downloaded
            from GitHub Releases. Wireless debugging is only needed for this ADB path - it is not
            required for the QR-code install above.
          </p>
        </div>
      </details>
    </section>
  );
}

/**
 * Only rendered inside the Electron desktop shell (window.atlasDesktop is undefined in the
 * regular browser deployment, including npm run dev:web). Toggling this requires restarting the
 * sidecar to actually change its bind address - see desktop/electron/main.js's
 * resolveAllowLanPairing - so this shows an explicit "Restart Atlas" prompt after a change
 * instead of pretending the toggle takes effect immediately.
 */
function LanPairingToggle() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [isBusy, startTransition] = useTransition();

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.atlasDesktop : undefined;
    if (!bridge?.lanPairing) {
      return;
    }
    setIsDesktop(true);
    bridge.lanPairing.get().then(setEnabled);
  }, []);

  if (!isDesktop) {
    return (
      <p className="atlas-note">
        The phone-pairing network toggle is only available inside the installed Atlas desktop app,
        not this browser preview.
      </p>
    );
  }

  function toggle() {
    startTransition(async () => {
      const bridge = window.atlasDesktop;
      if (!bridge?.lanPairing) {
        return;
      }
      const next = !enabled;
      await bridge.lanPairing.set(next);
      setEnabled(next);
      setNeedsRestart(true);
    });
  }

  function restart() {
    window.atlasDesktop?.lanPairing.restart();
  }

  return (
    <div className="atlas-control-card">
      <div className="atlas-control-card__content">
        <div className="atlas-control-card__title">Allow phone pairing on this network</div>
        <div className="atlas-control-card__meta">
          When off (default), Atlas only accepts connections from this device; a phone cannot
          reach it even with a valid pairing code. When on, Atlas also listens on this
          network&apos;s address, gated by the pairing code and device token flow.
        </div>
      </div>
      <div className="atlas-control-card__actions">
        <input type="checkbox" checked={enabled} onChange={toggle} disabled={isBusy} />
      </div>
      {needsRestart ? (
        <button type="button" className="atlas-button atlas-button--secondary" onClick={restart}>
          Restart Atlas to apply
        </button>
      ) : null}
    </div>
  );
}
