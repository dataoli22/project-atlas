"use client";

import { useState, useTransition } from "react";

import type { PairedDeviceData, PairingStartData } from "@/lib/pairing-data";
import { revokeDevice, startPairing } from "@/lib/pairing-data";

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
          : "No local network address was detected. Make sure this device is on Wi-Fi, not just loopback."
      );
    });
  }

  function revoke(deviceId: string) {
    startRevokeTransition(async () => {
      const result = await revokeDevice(deviceId);
      if (result === null) {
        setStatus("Could not revoke that device - the local backend was unreachable.");
        return;
      }
      setDevices(result);
      setStatus("Device unpaired.");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Phone pairing</div>
      <p className="atlas-note">
        Pair the Atlas Companion phone app to sync Health Connect / HealthKit data from your phone.
        Both devices must be on the same local network - nothing is relayed through a hosted
        server. Requires this desktop to be launched with phone pairing allowed (see the desktop
        packaging docs for the <code>ATLAS_ALLOW_LAN_PAIRING</code> flag); without it, the API
        stays loopback-only and a phone will not be able to reach it even with a valid code.
      </p>

      <div className="atlas-stack">
        {devices.length === 0 ? (
          <p className="atlas-placeholder">No devices paired.</p>
        ) : (
          devices.map((device) => (
            <div key={device.deviceId} className="atlas-list-card">
              <div className="atlas-list-card__title">{device.deviceName}</div>
              <div className="atlas-list-card__meta">
                Paired {device.pairedAt} | Last sync: {device.lastSyncAt ?? "Never"}
              </div>
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
          </div>
        </div>
      ) : null}

      <button type="button" className="atlas-button atlas-button--primary" onClick={beginPairing} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start pairing a phone"}
      </button>

      <p className="atlas-note">{status}</p>
    </section>
  );
}
