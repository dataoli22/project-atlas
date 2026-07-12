import { useEffect, useState } from "react";
import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";

import {
  confirmPairing,
  syncHealthConnectData,
  syncSamsungHealthData,
  testConnection,
  type SamsungHealthSyncPayload,
  type SyncPayload
} from "./desktop-api";
import { clearPairing, loadPairing, savePairing, type StoredPairing } from "./pairing-store";
import { HealthConnect } from "./health-connect-plugin";
import { SamsungHealth } from "./samsung-health-plugin";

const SYNC_WINDOW_HOURS = 24;

function sinceIso(): string {
  return new Date(Date.now() - SYNC_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

interface DeepLinkPairing {
  desktopBaseUrl: string;
  code: string;
}

/**
 * Parses the atlas://pair?host=...&port=...&code=... deep link the desktop's QR code encodes
 * (see AndroidManifest.xml's atlas/pair intent-filter and the desktop pairing-settings-form's QR
 * rendering). Returns null for anything else so a malformed or unrelated URL just falls through
 * to the normal manual-entry pairing screen instead of throwing.
 */
function parsePairingDeepLink(url: string): DeepLinkPairing | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "atlas:" || parsed.hostname !== "pair") {
      return null;
    }
    const host = parsed.searchParams.get("host");
    const port = parsed.searchParams.get("port");
    const code = parsed.searchParams.get("code");
    if (!host || !port || !code) {
      return null;
    }
    return { desktopBaseUrl: `${host}:${port}`, code };
  } catch {
    return null;
  }
}

export default function App() {
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [isLoadingPairing, setIsLoadingPairing] = useState(true);
  const [deepLinkPairing, setDeepLinkPairing] = useState<DeepLinkPairing | null>(null);

  useEffect(() => {
    loadPairing()
      .then(setPairing)
      .finally(() => setIsLoadingPairing(false));

    const listenerPromise = CapacitorApp.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      const parsed = parsePairingDeepLink(event.url);
      if (parsed) {
        setDeepLinkPairing(parsed);
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  if (isLoadingPairing) {
    return null;
  }

  return (
    <div className="atlas-mobile-app">
      <h1 className="atlas-mobile-title">Atlas Companion</h1>
      {pairing ? (
        <SyncScreen pairing={pairing} onUnpair={() => { clearPairing(); setPairing(null); }} />
      ) : (
        <PairScreen onPaired={setPairing} deepLink={deepLinkPairing} />
      )}
    </div>
  );
}

function PairScreen({
  onPaired,
  deepLink
}: {
  onPaired: (pairing: StoredPairing) => void;
  deepLink: DeepLinkPairing | null;
}) {
  const [desktopBaseUrl, setDesktopBaseUrl] = useState(deepLink?.desktopBaseUrl ?? "");
  const [code, setCode] = useState(deepLink?.code ?? "");
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!deepLink) {
      return;
    }
    setDesktopBaseUrl(deepLink.desktopBaseUrl);
    setCode(deepLink.code);
    // Deliberately NOT auto-submitting here. A deep link only proves someone scanned a QR code or
    // fired the atlas://pair intent - not that the user verified which server it points to. A
    // malicious QR code (or another app firing the same intent) could pre-fill an attacker's
    // host/port and, if auto-submitted, silently pair this device's Health Connect/Samsung Health
    // data to an attacker-controlled "desktop". Pre-filling the fields and still requiring an
    // explicit tap on "Pair with desktop" below keeps the user in the loop on what they're
    // confirming, while still saving them from typing the address/code by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  async function checkConnection() {
    setIsBusy(true);
    setIsError(false);
    const reachable = await testConnection(desktopBaseUrl);
    setStatus(reachable ? "Desktop is reachable on this network." : "Could not reach that address.");
    setIsError(!reachable);
    setIsBusy(false);
  }

  async function pair(overrideBaseUrl?: string, overrideCode?: string) {
    setIsBusy(true);
    setIsError(false);
    setStatus(null);
    try {
      const result = await confirmPairing(
        overrideBaseUrl ?? desktopBaseUrl,
        overrideCode ?? code,
        deviceName || "Unnamed phone"
      );
      await savePairing(result);
      onPaired(result);
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Pairing failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="atlas-mobile-card">
      <p className="atlas-mobile-note">
        On the desktop, open Settings &rarr; Phone pairing and start pairing. Enter the address and
        code shown there. Both devices must be on the same local network - nothing is sent anywhere
        else.
      </p>

      {deepLink ? (
        <p className="atlas-mobile-status">
          Filled in from the QR code you scanned. Check the address below matches your own
          desktop before tapping &quot;Pair with desktop&quot;.
        </p>
      ) : null}

      <label>
        <span className="atlas-mobile-note">Desktop address (IP:port)</span>
        <input
          className="atlas-mobile-input"
          placeholder="192.168.0.42:8000"
          value={desktopBaseUrl}
          onChange={(event) => setDesktopBaseUrl(event.target.value)}
        />
      </label>

      <button className="atlas-mobile-button atlas-mobile-button--secondary" onClick={checkConnection} disabled={isBusy || !desktopBaseUrl}>
        Test connection
      </button>

      <label>
        <span className="atlas-mobile-note">Pairing code</span>
        <input
          className="atlas-mobile-input"
          placeholder="123456"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>

      <label>
        <span className="atlas-mobile-note">This device's name</span>
        <input
          className="atlas-mobile-input"
          placeholder="My phone"
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
        />
      </label>

      <button
        className="atlas-mobile-button"
        onClick={() => pair()}
        disabled={isBusy || !desktopBaseUrl || !code}
      >
        {isBusy ? "Pairing..." : "Pair with desktop"}
      </button>

      {status ? <p className={`atlas-mobile-status ${isError ? "atlas-mobile-status--error" : ""}`}>{status}</p> : null}
    </div>
  );
}

function SyncScreen({ pairing, onUnpair }: { pairing: StoredPairing; onUnpair: () => void }) {
  const [status, setStatus] = useState("Paired. Ready to sync.");
  const [isError, setIsError] = useState(false);
  const [isSyncingHealthConnect, setIsSyncingHealthConnect] = useState(false);
  const [isSyncingSamsungHealth, setIsSyncingSamsungHealth] = useState(false);
  const [healthConnectAvailable, setHealthConnectAvailable] = useState<boolean | null>(null);
  const [samsungHealthAvailable, setSamsungHealthAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    HealthConnect.isAvailable()
      .then((result) => setHealthConnectAvailable(result.available))
      .catch(() => setHealthConnectAvailable(false));
    SamsungHealth.isAvailable()
      .then((result) => setSamsungHealthAvailable(result.available))
      .catch(() => setSamsungHealthAvailable(false));
  }, []);

  async function runHealthConnectSync() {
    setIsSyncingHealthConnect(true);
    setIsError(false);
    try {
      const permission = await HealthConnect.requestPermissions();
      if (!permission.granted) {
        setStatus("Health Connect permissions were not granted.");
        setIsError(true);
        return;
      }

      const since = sinceIso();
      const [sessions, hydration, weight, steps] = await Promise.all([
        HealthConnect.readRecentSessions({ sinceIso: since }),
        HealthConnect.readHydrationMl({ sinceIso: since }),
        HealthConnect.readBodyWeightKg(),
        HealthConnect.readStepCount({ sinceIso: since })
      ]);

      const payload: SyncPayload = {
        device_label: pairing.deviceName,
        bridge_source: "health-connect-sdk",
        recent_sessions: sessions.sessions,
        ...(hydration.hydrationMl !== null ? { hydration_ml: hydration.hydrationMl } : {}),
        ...(weight.bodyWeightKg !== null ? { body_weight_kg: weight.bodyWeightKg } : {}),
        ...(steps.stepCount !== null ? { step_count: steps.stepCount } : {})
      };

      const result = await syncHealthConnectData(pairing, payload);
      setStatus(result.ok ? "Health Connect sync succeeded." : result.message);
      setIsError(!result.ok);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Health Connect sync failed.");
      setIsError(true);
    } finally {
      setIsSyncingHealthConnect(false);
    }
  }

  async function runSamsungHealthSync() {
    setIsSyncingSamsungHealth(true);
    setIsError(false);
    try {
      const permission = await SamsungHealth.requestPermissions();
      if (!permission.granted) {
        setStatus("Samsung Health permissions were not granted.");
        setIsError(true);
        return;
      }

      const [sessions, sleep, restingHr, energyScore, stressLevel] = await Promise.all([
        SamsungHealth.readRecentSessions({ sinceIso: sinceIso() }),
        SamsungHealth.readSleepHours(),
        SamsungHealth.readRestingHeartRate(),
        SamsungHealth.readEnergyScore(),
        SamsungHealth.readStressLevel()
      ]);

      const payload: SamsungHealthSyncPayload = {
        device_label: pairing.deviceName,
        bridge_source: "samsung-health-sdk",
        recent_sessions: sessions.sessions,
        ...(sleep.sleepHours !== null ? { sleep_hours: sleep.sleepHours } : {}),
        ...(restingHr.restingHr !== null ? { resting_hr: restingHr.restingHr } : {}),
        ...(energyScore.energyScore !== null ? { energy_score: energyScore.energyScore } : {}),
        ...(stressLevel.stressLevel !== null ? { stress_level: stressLevel.stressLevel } : {})
      };

      const result = await syncSamsungHealthData(pairing, payload);
      setStatus(result.ok ? "Samsung Health sync succeeded." : result.message);
      setIsError(!result.ok);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Samsung Health sync failed.");
      setIsError(true);
    } finally {
      setIsSyncingSamsungHealth(false);
    }
  }

  return (
    <div className="atlas-mobile-card">
      <div className="atlas-mobile-list-item">
        <span>Paired with</span>
        <strong>{pairing.desktopBaseUrl}</strong>
      </div>
      <div className="atlas-mobile-list-item">
        <span>Device name</span>
        <strong>{pairing.deviceName}</strong>
      </div>
      <div className="atlas-mobile-list-item">
        <span>Health Connect</span>
        <strong>{healthConnectAvailable === null ? "Checking..." : healthConnectAvailable ? "Available" : "Not available"}</strong>
      </div>
      <div className="atlas-mobile-list-item">
        <span>Samsung Health</span>
        <strong>
          {samsungHealthAvailable === null ? "Checking..." : samsungHealthAvailable ? "Available" : "App not installed"}
        </strong>
      </div>

      <button
        className="atlas-mobile-button"
        onClick={runHealthConnectSync}
        disabled={isSyncingHealthConnect || healthConnectAvailable === false}
      >
        {isSyncingHealthConnect ? "Syncing..." : "Sync Health Connect"}
      </button>

      <button
        className="atlas-mobile-button"
        onClick={runSamsungHealthSync}
        disabled={isSyncingSamsungHealth || samsungHealthAvailable === false}
      >
        {isSyncingSamsungHealth ? "Syncing..." : "Sync Samsung Health"}
      </button>

      <button className="atlas-mobile-button atlas-mobile-button--secondary" onClick={onUnpair}>
        Unpair this device
      </button>

      <p className={`atlas-mobile-status ${isError ? "atlas-mobile-status--error" : ""}`}>{status}</p>
    </div>
  );
}
