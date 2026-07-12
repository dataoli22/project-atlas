import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * JS-side interface for the native Capacitor plugin wrapping iOS's HealthKit (`HKHealthStore`) -
 * the iOS equivalent of `health-connect-plugin.ts`/`HealthConnectPlugin.kt` on Android. Same
 * shape as the Health Connect interface (reusing `HealthConnectSession` for session records) so
 * `desktop-api.ts`'s `SyncPayload` and the sync screen work unmodified regardless of platform.
 *
 * Implemented in `mobile/ios/App/App/HealthKitPlugin.swift` against Apple's documented HealthKit
 * API (workouts, dietary water, body mass, step count), but NOT build-verified or runtime-tested
 * - written from an environment with no Mac/Xcode/physical iPhone. Before relying on it:
 * 1. Add the HealthKit capability in Xcode (Signing & Capabilities -> + Capability -> HealthKit).
 * 2. Confirm `NSHealthShareUsageDescription` is set in `Info.plist` (already added).
 * 3. Add `HealthKitPlugin.swift` to the Xcode project via File -> Add Files to "App" (not by
 *    hand-editing `project.pbxproj`).
 * 4. Build to a real device (HealthKit is unavailable in the iOS Simulator for most sample
 *    types) and test permission grant/deny - HealthKit deliberately never reveals which specific
 *    permissions were granted vs denied, only that the authorization sheet completed.
 */
export interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentSessions(options: { sinceIso: string }): Promise<{ sessions: HealthConnectSession[] }>;
  readHydrationMl(options: { sinceIso: string }): Promise<{ hydrationMl: number | null }>;
  readBodyWeightKg(): Promise<{ bodyWeightKg: number | null }>;
  readStepCount(options: { sinceIso: string }): Promise<{ stepCount: number | null }>;
}

export const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");
