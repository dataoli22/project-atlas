import { requestJson, type ApiDataSource } from "@/lib/api";

export type DataEnvelope<T> = {
  data: T;
  source: ApiDataSource;
};

export interface AppLockSettingsData {
  enabled: boolean;
  hasPin: boolean;
  updatedAt: string | null;
}

type AppLockSettingsApiResponse = {
  enabled: boolean;
  has_pin: boolean;
  updated_at: string | null;
};

const appLockFallback: AppLockSettingsApiResponse = {
  enabled: false,
  has_pin: false,
  updated_at: null
};

function mapAppLockSettings(response: AppLockSettingsApiResponse): AppLockSettingsData {
  return {
    enabled: response.enabled,
    hasPin: response.has_pin,
    updatedAt: response.updated_at
  };
}

export async function getAppLockSettingsData(): Promise<DataEnvelope<AppLockSettingsData>> {
  const result = await requestJson<AppLockSettingsApiResponse>("/api/v1/app/lock", {
    fallback: appLockFallback
  });

  return { data: mapAppLockSettings(result.data), source: result.source };
}

export async function updateAppLock(input: {
  enabled: boolean;
  pin?: string;
  currentPin?: string;
}): Promise<{ ok: true; data: AppLockSettingsData } | { ok: false; message: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_ATLAS_API_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/api/v1/app/lock`, {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: input.enabled,
        pin: input.pin ?? null,
        current_pin: input.currentPin ?? null
      })
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      return {
        ok: false,
        message: detail?.detail ?? `Request failed with status ${response.status}`
      };
    }

    return { ok: true, data: mapAppLockSettings((await response.json()) as AppLockSettingsApiResponse) };
  } catch {
    return { ok: false, message: "Atlas could not reach the local backend to update the app lock." };
  }
}

/**
 * Unlike other loaders in this codebase, this deliberately does NOT use the
 * fallback-to-stub-data convention: if the backend is unreachable, an app lock must fail
 * closed (report unable-to-verify) rather than silently unlocking.
 */
export async function verifyAppLockPin(
  pin: string
): Promise<{ ok: true; unlocked: boolean } | { ok: false }> {
  const baseUrl = process.env.NEXT_PUBLIC_ATLAS_API_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/api/v1/app/lock/verify`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });

    if (!response.ok) {
      return { ok: false };
    }

    const payload = (await response.json()) as { unlocked: boolean };
    return { ok: true, unlocked: payload.unlocked };
  } catch {
    return { ok: false };
  }
}
