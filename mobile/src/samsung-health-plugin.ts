import { registerPlugin } from "@capacitor/core";

import type { HealthConnectSession } from "./desktop-api";

/**
 * NOT IMPLEMENTED, and blocked differently than Health Connect/HealthKit were.
 *
 * `health-connect-plugin.ts` and `healthkit-plugin.ts` were "not implemented yet" purely for
 * tooling reasons (no Android SDK / no Mac in this environment) - the underlying SDKs are
 * publicly available to any developer, so once real hardware is available, implementing them is
 * just engineering work. Samsung Health is different: the Samsung Health SDK for Android
 * (com.samsung.android.sdk.health) requires enrolling in the **Samsung Health Partner Program**
 * and getting the app's package explicitly approved by Samsung before the SDK will authenticate
 * at all - see https://developer.samsung.com/health/android/data/partner. That is a business/
 * legal step (an application + Samsung's review), not something a device or SDK download alone
 * unblocks, so this interface documents the intended contract without a path to implement it
 * until that approval exists.
 *
 * In practice this may matter less than it sounds: on modern Samsung devices, Samsung Health
 * itself writes most of its data (steps, sleep, heart rate, workouts) into Android's shared
 * Health Connect store, so `health-connect-plugin.ts` already covers a meaningful chunk of what
 * this would provide. The fields unique to this interface - `stressLevel`/`energyScore`,
 * Samsung's own composite wellness metrics - are the main reason a dedicated bridge would still
 * be worth pursuing if partner approval is obtained later.
 *
 * Backend contract already exists and is stable: see
 * apps/api/app/features/shared/schemas/app.py's SamsungHealthDeviceSyncRequest and
 * desktop-api.ts's SamsungHealthSyncPayload/syncSamsungHealthData - this plugin only needs to
 * produce data in that shape once (if ever) it can be implemented.
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

/**
 * Will throw at call time until the native plugin above is implemented and registered (blocked
 * on Samsung Health Partner Program approval - see the module doc comment above). Left
 * registered so call sites can be written now against the real interface.
 */
export const SamsungHealth = registerPlugin<SamsungHealthPlugin>("SamsungHealth");
