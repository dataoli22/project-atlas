import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * JS-side interface for the native Capacitor plugin backing Android's Health Connect SDK
 * (androidx.health.connect). There is no first-party Capacitor Health Connect plugin, so this is
 * a small custom native Android plugin - see
 * mobile/android/app/src/main/java/com/projectatlas/mobile/HealthConnectPlugin.kt.
 *
 * The Kotlin implementation exists and is registered in MainActivity.java, but has not been
 * built or run on a real device/emulator (no Android SDK in this environment) - build and
 * exercise it in Android Studio before relying on it, in particular permission grant, denial,
 * and partial-grant flows across OEM builds.
 */
export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentSessions(options: { sinceIso: string }): Promise<{ sessions: HealthConnectSession[] }>;
  readHydrationMl(options: { sinceIso: string }): Promise<{ hydrationMl: number | null }>;
  readBodyWeightKg(): Promise<{ bodyWeightKg: number | null }>;
  readStepCount(options: { sinceIso: string }): Promise<{ stepCount: number | null }>;
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");
