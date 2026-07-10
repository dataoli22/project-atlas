import type { StoredPairing } from "./pairing-store";

export interface HealthConnectSession {
  session_label: string;
  session_type: string;
  duration_minutes: number;
  distance_km?: number;
  start_date: string;
  source: string;
}

export interface SyncPayload {
  device_label?: string;
  bridge_source?: "health-connect-sdk" | "google-fit-health-connect" | "manual-import";
  recent_sessions: HealthConnectSession[];
  hydration_ml?: number;
  body_weight_kg?: number;
  step_count?: number;
  active_energy_kcal?: number;
}

export interface SamsungHealthSyncPayload {
  device_label?: string;
  bridge_source?: "samsung-health-sdk" | "manual-import";
  recent_sessions: HealthConnectSession[];
  sleep_hours?: number;
  resting_hr?: number;
  energy_score?: number;
  stress_level?: string;
}

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `http://${trimmed}`;
}

export async function testConnection(desktopBaseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${normalizeBaseUrl(desktopBaseUrl)}/api/v1/health`, {
      method: "GET"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function confirmPairing(
  desktopBaseUrl: string,
  code: string,
  deviceName: string
): Promise<StoredPairing> {
  const base = normalizeBaseUrl(desktopBaseUrl);
  const response = await fetch(`${base}/api/v1/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, device_name: deviceName })
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Pairing failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    device_id: string;
    device_token: string;
    device_name: string;
  };

  return {
    desktopBaseUrl: base,
    deviceId: payload.device_id,
    deviceToken: payload.device_token,
    deviceName: payload.device_name
  };
}

const SYNC_RETRY_DELAYS_MS = [500, 1500, 4000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A phone on Wi-Fi genuinely drops packets and hits transient DNS/connection hiccups that a
 * desktop's wired/stable connection mostly doesn't - a single failed fetch here is not
 * necessarily "the desktop is gone", so retry network-level failures and 5xx responses with
 * backoff. 4xx responses (bad/expired token, validation errors) are NOT retried - retrying an
 * auth failure just wastes battery hammering a request that cannot succeed until the user
 * re-pairs. Shared by both device-sync endpoints (Health Connect, Samsung Health) since the
 * retry/backoff policy is identical - only the path and payload shape differ.
 */
async function postDeviceSyncWithRetry(
  pairing: StoredPairing,
  path: string,
  payload: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  let lastMessage = "Could not reach the desktop.";

  for (let attempt = 0; attempt <= SYNC_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(`${pairing.desktopBaseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Atlas-Device-Id": pairing.deviceId,
          Authorization: `Bearer ${pairing.deviceToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return { ok: true };
      }

      const detail = await response.json().catch(() => null);
      lastMessage = detail?.detail ?? `Sync failed with status ${response.status}`;

      if (response.status < 500) {
        // Client error (bad token, validation, etc.) - retrying will not help.
        return { ok: false, message: lastMessage };
      }
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Could not reach the desktop.";
    }

    if (attempt < SYNC_RETRY_DELAYS_MS.length) {
      await delay(SYNC_RETRY_DELAYS_MS[attempt]);
    }
  }

  return { ok: false, message: lastMessage };
}

export function syncHealthConnectData(
  pairing: StoredPairing,
  payload: SyncPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  return postDeviceSyncWithRetry(pairing, "/api/v1/integrations/health_connect/device-sync", payload);
}

export function syncSamsungHealthData(
  pairing: StoredPairing,
  payload: SamsungHealthSyncPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  return postDeviceSyncWithRetry(pairing, "/api/v1/integrations/samsung_health/device-sync", payload);
}
