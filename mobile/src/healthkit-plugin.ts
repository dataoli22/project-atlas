import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * NOT IMPLEMENTED. JS-side interface for a native Capacitor plugin wrapping iOS's HealthKit
 * (`HKHealthStore`) - the iOS equivalent of `health-connect-plugin.ts`/`HealthConnectPlugin.kt`
 * on Android. Deliberately the same shape as the Health Connect interface (reusing
 * `HealthConnectSession` for session records) so `desktop-api.ts`'s `SyncPayload` and the sync
 * screen work unmodified regardless of platform.
 *
 * Real implementation work still needed, in order (requires a Mac + Xcode + a physical iPhone -
 * see docs/feature-specs/mobile-architecture.md section 4 for the self-compile build flow):
 * 1. Add HealthKit capability + `NSHealthShareUsageDescription` to `mobile/ios/App/App/Info.plist`.
 * 2. Implement `HealthKitPlugin.swift`: request read authorization via
 *    `HKHealthStore.requestAuthorization`, then query `HKSampleQuery`/`HKStatisticsQuery` for
 *    workouts, dietary water, body mass, step count, and active energy burned.
 * 3. Map HealthKit's sample types (`HKWorkoutType`, `HKQuantityTypeIdentifierDietaryWater`,
 *    `HKQuantityTypeIdentifierBodyMass`, `HKQuantityTypeIdentifierStepCount`,
 *    `HKQuantityTypeIdentifierActiveEnergyBurned`) onto the same fields this interface returns.
 * 4. Register the plugin in `AppDelegate.swift` and test permission grant/denial on a real
 *    device (HealthKit is unavailable in the iOS Simulator for most sample types).
 */
export interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentSessions(options: { sinceIso: string }): Promise<{ sessions: HealthConnectSession[] }>;
  readHydrationMl(options: { sinceIso: string }): Promise<{ hydrationMl: number | null }>;
  readBodyWeightKg(): Promise<{ bodyWeightKg: number | null }>;
  readStepCount(options: { sinceIso: string }): Promise<{ stepCount: number | null }>;
}

/**
 * Will throw at call time until the native plugin above is implemented and registered. Left
 * registered so call sites can be written now against the real interface.
 */
export const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");
