import { useEffect, useState } from "react";

import { confirmPairing, syncHealthConnectData, testConnection } from "./desktop-api";
import { clearPairing, loadPairing, savePairing, type StoredPairing } from "./pairing-store";
import { HealthConnect } from "./health-connect-plugin";

export default function App() {
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [isLoadingPairing, setIsLoadingPairing] = useState(true);

  useEffect(() => {
    loadPairing()
      .then(setPairing)
      .finally(() => setIsLoadingPairing(false));
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
        <PairScreen onPaired={setPairing} />
      )}
    </div>
  );
}

function PairScreen({ onPaired }: { onPaired: (pairing: StoredPairing) => void }) {
  const [desktopBaseUrl, setDesktopBaseUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  async function checkConnection() {
    setIsBusy(true);
    setIsError(false);
    const reachable = await testConnection(desktopBaseUrl);
    setStatus(reachable ? "Desktop is reachable on this network." : "Could not reach that address.");
    setIsError(!reachable);
    setIsBusy(false);
  }

  async function pair() {
    setIsBusy(true);
    setIsError(false);
    setStatus(null);
    try {
      const result = await confirmPairing(desktopBaseUrl, code, deviceName || "Unnamed phone");
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
        onClick={pair}
        disabled={isBusy || !desktopBaseUrl || !code}
      >
        {isBusy ? "Pairing..." : "Pair with desktop"}
      </button>

      {status ? <p className={`atlas-mobile-status ${isError ? "atlas-mobile-status--error" : ""}`}>{status}</p> : null}
    </div>
  );
}

function SyncScreen({ pairing, onUnpair }: { pairing: StoredPairing; onUnpair: () => void }) {
  const [status, setStatus] = useState("Paired. Health Connect data collection is not implemented yet.");
  const [isError, setIsError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthConnectAvailable, setHealthConnectAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    HealthConnect.isAvailable()
      .then((result) => setHealthConnectAvailable(result.available))
      .catch(() => setHealthConnectAvailable(false));
  }, []);

  async function runManualSync() {
    setIsSyncing(true);
    setIsError(false);
    // Sends an empty payload - this exercises and verifies the real pairing + auth + sync
    // wiring end to end without depending on the not-yet-implemented Health Connect plugin.
    const result = await syncHealthConnectData(pairing, {
      device_label: pairing.deviceName,
      bridge_source: "manual-import",
      recent_sessions: []
    });
    setStatus(result.ok ? "Sync succeeded (test payload - no Health Connect data collected yet)." : result.message);
    setIsError(!result.ok);
    setIsSyncing(false);
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
        <strong>{healthConnectAvailable === null ? "Checking..." : healthConnectAvailable ? "Available" : "Not implemented"}</strong>
      </div>

      <button className="atlas-mobile-button" onClick={runManualSync} disabled={isSyncing}>
        {isSyncing ? "Syncing..." : "Send test sync"}
      </button>

      <button className="atlas-mobile-button atlas-mobile-button--secondary" onClick={onUnpair}>
        Unpair this device
      </button>

      <p className={`atlas-mobile-status ${isError ? "atlas-mobile-status--error" : ""}`}>{status}</p>
    </div>
  );
}
