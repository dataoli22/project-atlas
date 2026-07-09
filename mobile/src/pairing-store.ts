import { Preferences } from "@capacitor/preferences";

// Persisted locally on the phone only - never synced anywhere else. This is the phone's half of
// the pairing relationship established via POST /api/v1/pairing/confirm on the desktop's API.
export interface StoredPairing {
  desktopBaseUrl: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
}

const STORAGE_KEY = "atlas.pairing";

export async function loadPairing(): Promise<StoredPairing | null> {
  const result = await Preferences.get({ key: STORAGE_KEY });
  if (!result.value) {
    return null;
  }
  try {
    return JSON.parse(result.value) as StoredPairing;
  } catch {
    return null;
  }
}

export async function savePairing(pairing: StoredPairing): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(pairing) });
}

export async function clearPairing(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEY });
}
