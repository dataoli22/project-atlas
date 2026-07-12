"use client";

import { useState, useTransition } from "react";

import type { ApiDataSource } from "@/lib/api";
import type { AppLockSettingsData } from "@/lib/app-lock-data";
import { updateAppLock } from "@/lib/app-lock-data";

type AppLockSettingsFormProps = {
  initialSettings: AppLockSettingsData;
  initialSource: ApiDataSource;
};

export function AppLockSettingsForm({ initialSettings, initialSource }: AppLockSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [status, setStatus] = useState(
    initialSource === "api"
      ? "App lock state loaded from the local backend."
      : "Backend unavailable, showing the default (disabled) app lock state."
  );
  const [isSaving, startTransition] = useTransition();

  function enableLock() {
    if (pin.length < 4) {
      setStatus("Choose a PIN with at least 4 characters.");
      return;
    }
    if (pin !== confirmPin) {
      setStatus("PIN and confirmation do not match.");
      return;
    }

    startTransition(async () => {
      const result = await updateAppLock({
        enabled: true,
        pin,
        currentPin: settings.hasPin ? currentPin : undefined
      });

      if (!result.ok) {
        setStatus(result.message);
        return;
      }

      setSettings(result.data);
      setPin("");
      setConfirmPin("");
      setCurrentPin("");
      setStatus("App lock is enabled. You will need this PIN the next time Atlas loads.");
    });
  }

  function disableLock() {
    startTransition(async () => {
      const result = await updateAppLock({ enabled: false, currentPin });

      if (!result.ok) {
        setStatus(result.message);
        return;
      }

      setSettings(result.data);
      setCurrentPin("");
      setStatus("App lock is disabled.");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">App lock</div>
      <p className="atlas-note">
        Optional local PIN gate for shared devices. This only deters casual access on this device -
        Atlas has no accounts, no server, and no way to recover a forgotten PIN except disabling the
        lock from the local database.
      </p>
      <div className="atlas-meta">
        <span>Status: {settings.enabled ? "Enabled" : "Disabled"}</span>
      </div>

      {settings.enabled ? (
        <div className="atlas-stack">
          <label className="atlas-form-field">
            <span>Current PIN (required to change or disable)</span>
            <input
              id="app-lock-current-pin"
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="atlas-button atlas-button--secondary"
            disabled={isSaving || currentPin.length === 0}
            onClick={disableLock}
          >
            Disable app lock
          </button>
        </div>
      ) : null}

      <div className="atlas-stack">
        <label className="atlas-form-field">
          <span>{settings.enabled ? "New PIN" : "Set a PIN"}</span>
          <input
            id="app-lock-new-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="At least 4 characters"
          />
        </label>
        <label className="atlas-form-field">
          <span>Confirm PIN</span>
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value)}
            placeholder="Confirm PIN"
          />
        </label>
        <button
          type="button"
          className="atlas-button atlas-button--primary"
          disabled={isSaving || pin.length === 0}
          onClick={enableLock}
        >
          {settings.enabled ? "Change PIN" : "Enable app lock"}
        </button>
      </div>

      <p className="atlas-note">{status}</p>
    </section>
  );
}
