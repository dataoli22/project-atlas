"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import type { AppLockSettingsData } from "@/lib/app-lock-data";
import { verifyAppLockPin } from "@/lib/app-lock-data";

const SESSION_UNLOCK_KEY = "atlas-app-lock-unlocked";

type AppLockGateProps = {
  initialLockSettings: AppLockSettingsData;
  children: ReactNode;
};

function isAlreadyUnlockedThisSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === "true";
}

export function AppLockGate({ initialLockSettings, children }: AppLockGateProps) {
  const [unlocked, setUnlocked] = useState(
    () => !initialLockSettings.enabled || isAlreadyUnlockedThisSession()
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (unlocked) {
    return <>{children}</>;
  }

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await verifyAppLockPin(pin);

    setIsSubmitting(false);

    if (!result.ok) {
      setError("Could not reach the local Atlas backend to verify the PIN. Try again.");
      return;
    }

    if (!result.unlocked) {
      setError("That PIN did not match. Try again.");
      setPin("");
      return;
    }

    window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "true");
    setUnlocked(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <form
        onSubmit={submitPin}
        className="atlas-panel atlas-stack"
        style={{ maxWidth: "360px", width: "100%" }}
      >
        <div className="atlas-panel__eyebrow">Atlas is locked</div>
        <p className="atlas-note">
          This device has a local app lock enabled. Enter the PIN to continue. The PIN is checked
          on this device only and never leaves it.
        </p>
        <label className="atlas-form-field">
          <span>PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Enter PIN"
          />
        </label>
        {error ? <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>{error}</p> : null}
        <button
          type="submit"
          className="atlas-button atlas-button--primary"
          disabled={isSubmitting || pin.length === 0}
        >
          {isSubmitting ? "Checking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
