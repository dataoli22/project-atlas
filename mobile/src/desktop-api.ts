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

export async function syncHealthConnectData(
  pairing: StoredPairing,
  payload: SyncPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${pairing.desktopBaseUrl}/api/v1/integrations/health_connect/device-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlas-Device-Id": pairing.deviceId,
        Authorization: `Bearer ${pairing.deviceToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      return { ok: false, message: detail?.detail ?? `Sync failed with status ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not reach the desktop." };
  }
}
