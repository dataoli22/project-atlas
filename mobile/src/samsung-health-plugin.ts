import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * JS-side interface for the native Capacitor plugin backing Samsung's Health Data SDK
 * (com.samsung.android.sdk.health.data, v1.1.0) - see
 * mobile/android/app/src/main/java/com/projectatlas/mobile/SamsungHealthPlugin.kt. Partner
 * Program approval is obtained and the SDK's real .aar is wired into the Gradle build (gitignored
 * - it's Samsung's proprietary binary, not ours to redistribute).
 *
 * Not built or run on a real device - the Samsung Health app itself is Samsung-device-exclusive
 * (Galaxy Store only), so it cannot be installed on a generic AOSP emulator either. Build/compile-
 * verify in Android Studio, then exercise permission grant/deny and real data shape on an actual
 * Samsung device before relying on it.
 *
 * On modern Samsung devices, Samsung Health itself also writes most of its data (steps, sleep,
 * heart rate, workouts) into Android's shared Health Connect store, so `health-connect-plugin.ts`
 * already covers a meaningful chunk of what this provides. The fields unique to this interface -
 * `stressLevel`/`energyScore` - are Samsung's own composite wellness metrics; `stressLevel`
 * always resolves null in SDK v1.1.0 since no dedicated stress data type exists there.
 *
 * Backend contract: apps/api/app/features/shared/schemas/app.py's SamsungHealthDeviceSyncRequest
 * and desktop-api.ts's SamsungHealthSyncPayload/syncSamsungHealthData.
 */
export interface SamsungHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentSessions(options: { sinceIso: string }): Promise<{ sessions: HealthConnectSession[] }>;
  readSleepHours(): Promise<{ sleepHours: number | null }>;
  readRestingHeartRate(): Promise<{ restingHr: number | null }>;
  readEnergyScore(): Promise<{ energyScore: number | null }>;
  readStressLevel(): Promise<{ stressLevel: string | null }>;
}

export const SamsungHealth = registerPlugin<SamsungHealthPlugin>("SamsungHealth");
