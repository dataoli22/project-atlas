import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * NOT IMPLEMENTED. This is a documented interface for a custom native Capacitor plugin that
 * would wrap Android's Health Connect SDK (androidx.health.connect). There is no first-party
 * Capacitor Health Connect plugin as of writing, so this would need to be a small custom native
 * Android plugin (Kotlin) - see mobile/android/app/src/main/java/.../HealthConnectPlugin.kt for
 * where that implementation belongs once written.
 *
 * This interface exists so the rest of the app (desktop-api.ts's SyncPayload, the sync screen)
 * can be built and reasoned about against a stable shape now, without blocking on writing and
 * testing native Android code that cannot be verified in this environment (no SDK, no device).
 *
 * Real implementation work still needed, in order:
 * 1. Add the Health Connect SDK dependency to mobile/android/app/build.gradle.
 * 2. Declare the required health data permissions in AndroidManifest.xml.
 * 3. Implement HealthConnectPlugin.kt: request runtime permissions via
 *    PermissionController.createRequestPermissionResultContract(), then read records via
 *    HealthConnectClient.readRecords() for the record types requested here.
 * 4. Map Health Connect's record types (ExerciseSessionRecord, HydrationRecord, WeightRecord,
 *    StepsRecord, TotalCaloriesBurnedRecord) into HealthConnectSession / the other SyncPayload
 *    fields already defined in desktop-api.ts - the shapes were designed to line up with what
 *    Health Connect actually returns, not invented independently.
 * 5. Test permission grant, denial, and partial-grant flows on a real device or emulator.
 */
export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentSessions(options: { sinceIso: string }): Promise<{ sessions: HealthConnectSession[] }>;
  readHydrationMl(options: { sinceIso: string }): Promise<{ hydrationMl: number | null }>;
  readBodyWeightKg(): Promise<{ bodyWeightKg: number | null }>;
  readStepCount(options: { sinceIso: string }): Promise<{ stepCount: number | null }>;
}

/**
 * Will throw at call time until the native plugin above is actually implemented and registered
 * (registerPlugin resolves against mobile/android's native plugin registry, which does not yet
 * contain a HealthConnect implementation). Left registered so call sites can be written now
 * against the real interface.
 */
export const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");
