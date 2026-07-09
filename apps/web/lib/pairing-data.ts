import { resolveApiBaseUrl } from "@/lib/api";

export interface PairedDeviceData {
  deviceId: string;
  deviceName: string;
  pairedAt: string;
  lastSyncAt: string | null;
}

export interface PairingStartData {
  code: string;
  expiresAt: string;
  lanAddresses: string[];
  port: number;
}

type PairedDeviceApiResponse = {
  device_id: string;
  device_name: string;
  paired_at: string;
  last_sync_at: string | null;
};

type PairingStartApiResponse = {
  code: string;
  expires_at: string;
  lan_addresses: string[];
  port: number;
};

function mapDevice(response: PairedDeviceApiResponse): PairedDeviceData {
  return {
    deviceId: response.device_id,
    deviceName: response.device_name,
    pairedAt: response.paired_at,
    lastSyncAt: response.last_sync_at
  };
}

export async function getPairedDevices(): Promise<
  { ok: true; devices: PairedDeviceData[] } | { ok: false }
> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/api/v1/pairing/devices`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false };
    }
    const payload = (await response.json()) as PairedDeviceApiResponse[];
    return { ok: true, devices: payload.map(mapDevice) };
  } catch {
    return { ok: false };
  }
}

export async function startPairing(): Promise<{ ok: true; data: PairingStartData } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/api/v1/pairing/start`, {
      method: "POST",
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, message: `Request failed with status ${response.status}` };
    }
    const payload = (await response.json()) as PairingStartApiResponse;
    return {
      ok: true,
      data: {
        code: payload.code,
        expiresAt: payload.expires_at,
        lanAddresses: payload.lan_addresses,
        port: payload.port
      }
    };
  } catch {
    return { ok: false, message: "Atlas could not reach the local backend to start pairing." };
  }
}

export async function revokeDevice(deviceId: string): Promise<PairedDeviceData[] | null> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/api/v1/pairing/devices/${deviceId}`, {
      method: "DELETE",
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as PairedDeviceApiResponse[];
    return payload.map(mapDevice);
  } catch {
    return null;
  }
}
