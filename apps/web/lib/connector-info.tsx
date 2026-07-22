import { Smartphone, Watch, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { IntegrationSourceData } from "@/lib/settings-data";

export type ConnectorInfo = {
  key: IntegrationSourceData["key"];
  title: string;
  icon: LucideIcon;
  detail: string;
  hintLabel: string;
  hint: ReactNode;
};

export const CONNECTOR_INFO: ConnectorInfo[] = [
  {
    key: "strava",
    title: "Strava",
    icon: Zap,
    detail: "Brings in recent activities and training load for the endurance module.",
    hintLabel: "Requirement: a registered Strava API app",
    hint: "Sign-in and sync are fully implemented, but each installation must register its own Strava API app first. Configure this once below."
  },
  {
    key: "health_connect",
    title: "Health Connect",
    icon: Smartphone,
    detail: "Android's health data hub: hydration, steps, active energy.",
    hintLabel: "Synced from your paired phone",
    hint: "Data comes from your paired phone, not from this device. Pair your phone under the Pair your device step to start syncing."
  },
  {
    key: "samsung_health",
    title: "Samsung Health",
    icon: Watch,
    detail: "Samsung's health app: sleep, resting heart rate, and energy score.",
    hintLabel: "Synced from your paired phone",
    hint: "Data comes from your paired phone, not from this device. Pair your phone under the Pair your device step to start syncing."
  }
];

// Health Connect / Samsung Health only exist on the phone - the desktop "Connect" click just
// stages local permission (needed before the paired phone can push real data). Strava is the one
// source that's actually reachable from the desktop itself, but even there `connected` flips true
// the moment the stub is staged, before the OAuth handoff is complete. In both cases `connected`
// alone overstates reality, so the UI's green "Connected" signal must check real completion:
// Strava needs a finished token exchange, the phone sources need a sync that actually arrived.
export function isFullyConnected(integration: IntegrationSourceData): boolean {
  if (integration.key === "strava") {
    return Boolean(integration.runtimeSummary.token_exchange_ready);
  }
  return Boolean(integration.lastSyncAt);
}

export function pendingConnectionNote(integration: IntegrationSourceData): string | null {
  if (!integration.connected || isFullyConnected(integration)) {
    return null;
  }
  if (integration.key === "strava") {
    return "Sign-in is not yet complete. Finish signing in below. If it fails, confirm a Strava API app is configured below.";
  }
  return "Permission has been staged on this device, but nothing has synced yet. Pair your phone under the Pair your device step to start syncing.";
}
