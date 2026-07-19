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
    hintLabel: "What Strava needs first",
    hint: "Sign-in and sync are real, working code - but Strava requires every installation to register its own API app first. Set that up once under Settings → Integrations (\"Strava API app\"), then this works for real."
  },
  {
    key: "health_connect",
    title: "Health Connect",
    icon: Smartphone,
    detail: "Android's health data hub - hydration, steps, active energy.",
    hintLabel: "Current state: early / unfinished",
    hint: "Clicking Connect only stages permission on this device - it doesn't pull real data. The phone-side code that would actually read Health Connect exists but hasn't been built or tested on a real device yet."
  },
  {
    key: "samsung_health",
    title: "Samsung Health",
    icon: Watch,
    detail: "Samsung's health app - sleep, resting heart rate, and energy score.",
    hintLabel: "Current state: early / unfinished",
    hint: "Clicking Connect only stages permission on this device - it doesn't pull real data. The phone-side code that would actually read Samsung Health exists but hasn't been built or tested on a real device yet."
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
    return "Almost there - finish signing in below. If it fails, make sure a Strava API app is configured under Settings → Integrations first.";
  }
  return "Permission staged on this device, but nothing has synced yet - the phone-side code for this isn't built or tested on a real device yet, so pairing and syncing may not work.";
}
