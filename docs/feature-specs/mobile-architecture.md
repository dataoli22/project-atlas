# Mobile Architecture (Android now, iOS later)

Last updated: July 9, 2026

This document explains why the mobile app is architecturally different from the desktop Electron
shell, what's actually built and verified, and what's still open. It's the reference for anyone
touching `mobile/` or the backend pairing endpoints.

---

## 1. Why mobile can't just reuse the desktop sidecar model

Desktop packaging (`docs/build-and-run/packaging-and-installation.md`) works by having Electron spawn the
FastAPI backend and a Next.js server as local child processes. That model **does not transfer to
mobile**:

- **FastAPI (Python) cannot run on iOS at all.** There is no supported way to embed a Python
  interpreter in an iOS app for App Store distribution.
- **Android could technically embed Python** via something like Chaquopy, but that's an
  Android-only solution — it wouldn't carry over to iOS, defeating the goal of one mobile
  codebase reaching both platforms, and it's a heavy, non-trivial embedding to get right.
- **Next.js's SSR model doesn't fit a WebView either.** Capacitor (and mobile WebViews generally)
  expect a bundle of **static** HTML/JS/CSS assets, not a live Node server. Next.js's
  `output: "export"` mode exists for this, but it requires the **entire** app to be statically
  exportable — every page, no server components doing live data fetches. Given `apps/web` is
  almost entirely server-rendered pages fetching from the backend at request time, forcing static
  export onto the whole app would be a large regression for desktop/browser use, not a mobile-only
  concern.

### The decision (explicit product choice, not a default)

- **Companion mode**: the phone does not run its own copy of Atlas's backend. It collects device
  health data (Health Connect on Android, HealthKit on iOS later) and syncs it to a **paired
  desktop** running Atlas on the same local network. No cloud server, no Atlas-hosted relay — this
  preserves the local-first posture, just shaped differently than desktop's self-contained model.
  The phone is only useful when a paired desktop is reachable on the LAN.
- **UI shell**: a small, purpose-built **Vite + React** app (`mobile/`), not a reuse of
  `apps/web`'s Next.js pages. Capacitor wraps this static bundle. This is a deliberate deviation
  from "wrap the existing app" — the actual UI surface needed for companion mode (pair, view
  paired status, trigger sync) is a handful of screens, not the full desktop nutrition/endurance
  UI, and Next.js's static-export constraints make forcing the full app into this shape worse than
  building the small thing directly. The mobile app reuses the desktop's design tokens (CSS custom
  properties copied into `mobile/src/atlas-mobile.css`) to stay visually consistent.

---

## 2. What's built and verified

### Backend: pairing + device tokens (`apps/api/app/features/shared/services/pairing.py`)

- `POST /api/v1/pairing/start` — desktop generates a short-lived (5 minute), single-use 6-digit
  code plus its detected LAN IPv4 addresses and port.
- `POST /api/v1/pairing/confirm` — phone submits the code + a device name; desktop issues a
  long-lived opaque bearer token (`secrets.token_urlsafe(32)`), shown to the caller exactly once.
  Tokens are hashed at rest (reusing `app_lock.py`'s PBKDF2 helpers — verify-only, no recovery,
  same reasoning as the app-lock PIN) and persisted through the existing SQLite-backed shared
  state.
- `GET /api/v1/pairing/devices` / `DELETE /api/v1/pairing/devices/{id}` — list and revoke paired
  devices from the desktop settings UI.
- **Auth on sync endpoints**: `require_paired_device_if_present` (`apps/api/app/api/deps.py`) is
  applied to both `health_connect/device-sync` and `samsung_health/device-sync`. It is
  **backward-compatible by design**: if `X-Atlas-Device-Id` + `Authorization: Bearer <token>`
  headers are absent, the request is treated like any other local caller (matching Atlas's
  existing single-user, no-accounts posture — see `docs/production-todo.md` section 3). A phone
  identifies itself with those headers; a mismatched or missing pair of headers is rejected with
  401.

**Verified live** (not just unit tests): full pairing flow run against a real running server —
code generation with real LAN address detection (`192.168.0.107` detected on this machine), code
confirmation issuing a real token, an authenticated sync call updating `last_sync_at`, a
wrong-token call correctly rejected with 401, and paired-device state surviving a full server
restart (SQLite persistence). 13 new backend tests, 102 total passing.

### LAN bind host — in-app toggle (`desktop/electron/main.js`, `preload.js`)

The sidecar binds to `127.0.0.1` by default. Phone pairing requires binding to `0.0.0.0` instead,
toggled from **Settings → Phone pairing → "Allow phone pairing on this network"**, not an env var:

- The preference lives in a small `desktop-prefs.json` file in Electron's `userData` directory,
  read/written via `readDesktopPrefs`/`writeDesktopPrefs` in `main.js`. It has to live outside the
  API's own SQLite state because the main process needs to know the bind host **before** it spawns
  the sidecar that would otherwise be the source of truth for that setting.
- `preload.js` exposes `window.atlasDesktop.lanPairing.{get,set,restart}` via `ipcRenderer.invoke`
  against `ipcMain.handle("atlas:get-lan-pairing"/"atlas:set-lan-pairing"/"atlas:restart-app")`.
- The settings UI (`LanPairingToggle` in `pairing-settings-form.tsx`) only renders inside the
  Electron shell (`window.atlasDesktop` is undefined in the plain browser dev server) and shows an
  explicit **"Restart Atlas to apply"** button after a change — the bind address genuinely cannot
  change without restarting the sidecar process, so the UI says so instead of pretending otherwise.
- `ATLAS_ALLOW_LAN_PAIRING=1` still works as a first-run fallback (used before any preference has
  been persisted), for anyone scripting a launch without going through the UI.

**Verified live, both directions**, by writing the prefs file directly and relaunching Electron
(bypassing the need to click through a UI in a headless environment — the toggle's own logic is a
thin IPC pass-through to the same `read/writeDesktopPrefs` functions exercised this way):
`allowLanPairing: true` → sidecar log showed `Uvicorn running on http://0.0.0.0:<port>`, confirmed
reachable via the real detected LAN IP (`curl http://192.168.0.107:<port>/api/v1/health` and a
live `/api/v1/pairing/start` call both succeeded from that address); `allowLanPairing: false` →
reverted to `127.0.0.1`-only on the next launch.

**Threat model note**: binding to `0.0.0.0` means *any* device on the same local network can reach
the API, not just a phone with a valid pairing code. The pairing code/device-token flow is the only
thing gating access to the pairing/sync endpoints specifically — other endpoints (settings, chat,
nutrition, etc.) remain reachable by anyone on the LAN once the toggle is on, matching Atlas's
existing no-auth-on-loopback posture extended to the LAN. Anyone wanting a stricter model should
keep the toggle off except during an active pairing session.

### Pairing code brute-force protection (`apps/api/app/features/shared/services/pairing.py`, `state.py`)

A 6-digit code has only 1,000,000 possibilities — the original implementation had **no limit** on
guesses within the 5-minute window, a real vulnerability on a LAN with multiple devices able to
hit the endpoint. Fixed:

- `MAX_PAIRING_ATTEMPTS = 5` — after this many wrong guesses against one code, the code is
  **invalidated outright** (not just rate-limited), forcing a fresh code to be started on the
  desktop, which a remote attacker cannot do.
- Attempt counting resets when a new pairing session starts (`start_device_pairing`), so a
  legitimate retry-after-typo doesn't get penalized by a previous session's failed guesses.
- Code comparison uses `hmac.compare_digest` instead of `!=`, avoiding a (largely theoretical, but
  free to fix) timing side-channel.

Verified via 3 new tests: invalidation after `MAX_PAIRING_ATTEMPTS` wrong guesses (confirmed the
*correct* code no longer works afterward, proving the code was invalidated, not just the guess
rejected), attempt counter resetting on a fresh `start_device_pairing`, and confirming without any
pending code fails cleanly. 105 backend tests total passing.

### Mobile sync retry with backoff (`mobile/src/desktop-api.ts`)

A phone on Wi-Fi genuinely drops packets and hits transient connection hiccups that a desktop's
more stable connection mostly doesn't. `syncHealthConnectData` now retries with backoff
(500ms/1500ms/4000ms) on network-level failures (`fetch` throwing) and `5xx` responses, but
**not** on `4xx` responses (expired/invalid token, validation errors) — retrying an auth failure
just wastes battery on a request that cannot succeed until the user re-pairs. Verified via a clean
`npm run mobile:build` (zero TypeScript errors); not exercised against a real flaky network, since
that needs a real device.

### Desktop UI (`apps/web/components/pairing-settings-form.tsx`)

A "Phone pairing" panel on `/settings/integrations`: start pairing (shows the code + LAN address +
expiry), lists paired devices with last-sync time, and lets you revoke a device. **Verified live**
against a real running API + web server — the page renders correctly, `/api/v1/pairing/start` and
`/api/v1/pairing/devices` both respond as expected.

### Mobile app (`mobile/`)

A Capacitor project: Vite + React + TypeScript, with the Android platform actually added via
`npx cap add android` (generates a real, standard native Android project — Gradle files,
`AndroidManifest.xml` with the `INTERNET` permission already present, launcher icons, etc.).

**What's real and verified**: the Vite build compiles cleanly (`npm run mobile:build`, zero
TypeScript errors), `npx cap add android` produced a structurally correct native project, and —
now that Android Studio's SDK/JDK are installed — `./gradlew assembleDebug` produces a real,
installed-nowhere-yet debug APK (`mobile/android/app/build/outputs/apk/debug/app-debug.apk`,
~5.5MB), with `HealthConnectPlugin.kt` compiling and linking successfully. Getting there fixed
three real build issues (see `mobile-architecture.md` git history for detail if needed): the
Health Connect client's newer alphas need `compileSdk 35` (this project targets `compileSdk 34`,
so the dependency is pinned to `1.1.0-alpha07`, the last version that only needs 34); Kotlin's
`compileDebugKotlin` needs an explicit `jvmTarget = "17"` to match `compileDebugJavaWithJavac`
(added to `app/build.gradle`); and the plugin's `requestPermissions` needed an `override` modifier
since Capacitor's base `Plugin` class already declares that method name.

**Verified live on a real Android emulator** (API 34 google_apis x86_64, via `avdmanager`): the
debug APK installs and runs, pairing against a locally-running `atlas-api.exe` sidecar over the
emulator's `10.0.2.2` host alias succeeds end-to-end (real pairing code exchange, not a stub), and
tapping "Sync Health Connect" launches the genuine Health Connect OS consent screen and correctly
handles a not-granted result without crashing. This surfaced two real, previously-undiscovered
bugs that blocked LAN pairing entirely on any modern Android device (not emulator-specific):
1. No `network_security_config.xml` existed, so Android 9+'s default cleartext block silently
   killed every LAN request. Fixed via `mobile/android/app/src/main/res/xml/network_security_config.xml`.
2. Capacitor's default `androidScheme: "https"` made Chromium block the LAN `http://` fetch as
   mixed content, independent of the OS-level fix above. Fixed by setting
   `server.androidScheme: "http"` in `mobile/capacitor.config.ts`.

Full permission-grant (not just deny) and the data-read path still need one more pass, plus a
partial-grant flow test - the emulator's Health Connect build didn't list Atlas under "App
permissions" after a first deny, which needs investigating on real hardware. See section 3.

Screens (`mobile/src/App.tsx`):
- **Pair screen**: enter the desktop's LAN address, test connectivity
  (`GET /api/v1/health`), enter the pairing code and a device name, confirm pairing.
- **Sync screen**: shows Health Connect / Samsung Health availability and two real sync
  buttons ("Sync Health Connect", "Sync Samsung Health"), each requesting permissions then
  reading and posting real on-device data to the matching `device-sync` endpoint.

Pairing state persists on-device via `@capacitor/preferences` (`mobile/src/pairing-store.ts`) —
the desktop base URL, device ID, and device token, never synced anywhere else.

### Health Connect data collection — implemented, unverified on-device

`mobile/src/health-connect-plugin.ts` defines the plugin interface
(`isAvailable`/`requestPermissions`/`readRecentSessions`/`readHydrationMl`/`readBodyWeightKg`/
`readStepCount`), and `mobile/android/app/src/main/java/com/projectatlas/mobile/HealthConnectPlugin.kt`
implements it against `HealthConnectClient`, registered in `MainActivity.java`. It compiles and
links (see above), but permission grant/deny/partial-grant flows and the actual record-reading
logic have not been exercised against a real device or emulator yet — that's the next step, not a
future implementation task. `App.tsx`'s "Sync Health Connect" button now requests permissions,
reads sessions/hydration/weight/steps from the trailing 24h window, and posts real values (not an
empty test payload) to `/api/v1/integrations/health_connect/device-sync`.

### Samsung Health data collection — implemented, unbuilt-on-device, partner access obtained

Samsung Health Partner Program approval was obtained and the real Samsung Health Data SDK v1.1.0
`.aar` (`mobile/android/app/libs/samsung-health-data-api-1.1.0.aar`, gitignored — it's Samsung's
proprietary binary, not ours to redistribute in a public repo; anyone rebuilding this project needs
their own partner approval and must download the SDK themselves from Samsung's developer portal)
is wired into `mobile/android/app/build.gradle`. Its manifest requires `minSdkVersion 29`, so the
whole app's `minSdkVersion` was bumped from 26 to 29 (`mobile/android/variables.gradle`) rather than
suppressing the manifest merge check.

`mobile/android/app/src/main/java/com/projectatlas/mobile/SamsungHealthPlugin.kt` implements the
JS interface (`mobile/src/samsung-health-plugin.ts`) against `HealthDataStore`, reading SLEEP,
HEART_RATE, and ENERGY_SCORE data types (the only ones this SDK version exposes that map to the
backend's `SamsungHealthDeviceSyncRequest` fields). Real exact field/method signatures were
obtained by decompiling the `.aar`'s `classes.jar` with `javap` (Samsung's bundled docs are just
meta-refresh redirects to their live site, unusable offline) — notably, static SDK fields declared
via Kotlin `@JvmField` in a companion object must be accessed through the class
(`DataType.SleepType.SESSIONS`), not through a `DataTypes.SLEEP` instance, which Kotlin disallows
even though Java would permit it. `:app:compileDebugKotlin` succeeds against the real SDK classes
(verified with `JAVA_HOME` pointed at Android Studio's bundled JBR).

Known real gaps, not fabricated around:
- **No dedicated "resting heart rate" data type** in SDK v1.1.0 — `readRestingHeartRate()`
  approximates it as the minimum `HEART_RATE` reading over the trailing 24h window
  (`HeartRateType.MIN_HEART_RATE`, an SDK-aggregated field, not client-computed).
- **No "stress" data type at all** in SDK v1.1.0 — `readStressLevel()` always resolves `null`.
- **No exercise-session read type exposed** in this SDK version — `readRecentSessions()` always
  returns empty; Health Connect's `ExerciseSessionRecord` already covers this ground on devices
  where Samsung Health writes into the shared Health Connect store.
- **The Samsung Health app itself is Samsung-device-exclusive** (Galaxy Store distribution, not
  Google Play), so it cannot be installed on a generic AOSP emulator — permission grant/deny flows
  and real data shape need an actual Samsung device to verify, same caveat as Health Connect but
  stronger (Health Connect at least installs on any Android 14+ emulator).

---

## 3. What you need to actually build and run this

Android Studio's SDK/JDK are now installed locally, and `./gradlew assembleDebug` has been run
successfully from this environment (JDK 17 via Android Studio's bundled JBR at
`Android Studio/jbr`, SDK at `%LOCALAPPDATA%\Android\Sdk`, `local.properties` with `sdk.dir` using
forward slashes — backslashes there throw an `Invalid file path` error from Gradle's SDK locator
on Windows). Remaining steps need a device or emulator, which this environment doesn't have:

1. `cd mobile && npm install && npm run cap:android` — builds the web assets, syncs them into the
   native project, and opens Android Studio (or run `./gradlew assembleDebug` from
   `mobile/android` directly, as already verified here).
2. Run on a device or emulator with Health Connect installed (Android 14+ has it built in;
   earlier versions need the Health Connect app from Play Store). Note the app's `minSdkVersion`
   is now 26 (bumped from Capacitor's default 22 — required by the Health Connect client).
3. Test the native `HealthConnectPlugin.kt` permission flow for real: grant, deny, and
   partial-grant, across at least one real device (emulators are inconsistent for Health Connect).
4. Test the full flow: launch desktop with `ATLAS_ALLOW_LAN_PAIRING=1`, start pairing in
   Settings → Phone pairing, pair the phone, grant Health Connect permissions, sync real data.

---

## 4. iOS (scaffolded; self-compile model, no App Store distribution)

There is no Apple Developer Program enrollment ($99/year) and no macOS build machine dedicated to
this project, and Xcode itself only runs on macOS — App Store/TestFlight distribution is out of
scope. Instead, iOS ships as **source you (or the end user) compile and install directly onto
their own iPhone from a Mac they own**, which Apple allows for free:

- A **free Apple ID** ("Personal Team" in Xcode) can sign and install an app directly onto an
  iPhone connected over USB, no paid enrollment required.
- The only catch: a free-signed app's provisioning profile expires after **7 days**, after which
  Xcode has to re-sign and reinstall it (one click: plug in the phone, hit Run again). This is an
  Apple platform limit, not something Atlas can work around without the $99/year program — worth
  it only if wide distribution beyond the user's own device is ever wanted.
- No jailbreak, no third-party sideloading store, no TestFlight needed for this flow.

**Scaffold status**: `npx cap add ios` has been run from `mobile/` — `mobile/ios/App/App.xcworkspace`
exists and is committed, generated the same way `cap add android` generated `mobile/android/`.
`pod install` and `xcodebuild` were skipped when scaffolding (no CocoaPods/Xcode in this
environment); run `pod install` inside `mobile/ios/App` the first time you open the project on a
Mac. The `desktop-api.ts`/`pairing-store.ts`/UI layer is already platform-agnostic (Capacitor
abstracts `Preferences` across platforms), so no web-layer changes are needed for iOS.

**To build and install on your own iPhone once you have a Mac with Xcode:**

1. `npm run mobile:build` (builds the Vite web assets and runs `cap sync`).
2. `cd mobile/ios/App && pod install` (installs CocoaPods dependencies — one-time, and again after
   any native dependency change).
3. Open `mobile/ios/App/App.xcworkspace` in Xcode (not the `.xcodeproj` — CocoaPods requires the
   workspace).
4. In the project's Signing & Capabilities tab, choose your Apple ID as the team (Xcode will
   offer to create a free "Personal Team" if you sign in with an Apple ID that has no paid
   enrollment).
5. Plug in the iPhone, select it as the run destination, hit Run. First launch requires trusting
   the developer certificate on the phone: Settings → General → VPN & Device Management.
6. Re-run from Xcode every 7 days to refresh the provisioning profile (or move to the paid
   Developer Program if that friction becomes unacceptable).

**Still needed before this is a real companion app** (not blocked on tooling, just not written
yet — see `mobile/src/healthkit-plugin.ts` for the documented-but-unimplemented interface):
implement `HealthKitPlugin.swift` using `HKHealthStore`, matching the same shape as
`health-connect-plugin.ts`/`HealthConnectPlugin.kt` on Android (same `SyncPayload` fields, so
`desktop-api.ts` and the sync screen need no changes). This has to be written and tested on an
actual Mac + iPhone, which is outside this environment.

---

## 5. Open items

- [x] Real Android build (Android Studio's SDK/JDK now installed): `assembleDebug` produces a real
      APK, `compileDebugKotlin` succeeds against both `HealthConnectPlugin.kt` and
      `SamsungHealthPlugin.kt` (the latter against the real Samsung Health `.aar`). Still needed:
      an actual on-device run — see the Health Connect and Samsung Health sections above for what
      each specifically still needs verified.
- [x] Native `HealthConnectPlugin.kt` implementation — written, registered in `MainActivity.java`,
      compiles; `App.tsx`'s sync button now sends real collected data, not an empty test payload.
      Permission grant/deny/partial-grant flows still need a real device/emulator.
- [x] Native `SamsungHealthPlugin.kt` implementation — Partner Program access obtained, real SDK
      `.aar` wired in, plugin written against decompiled real signatures, registered in
      `MainActivity.java`, compiles. Cannot be exercised on any emulator (Samsung Health app is
      device-exclusive) — needs a real Samsung device.
- [x] In-app "restart to apply" UX for the LAN pairing toggle — done, see section 2
- [x] Pairing code brute-force protection — done, see section 2
- [x] Mobile sync retry/backoff on transient network failures — done, see section 2
- [x] iOS: `cap add ios` scaffold committed (`mobile/ios/`); self-compile/sideload build flow
      documented in section 4 — no App Store distribution planned
- [ ] iOS: `HealthKitPlugin.swift` implementation (needs a Mac + Xcode + iPhone to write and test)
- [ ] App icon / branding for the mobile app (Capacitor's default template icons are in place)
- [ ] Play Store listing and release process (Android only — iOS ships self-compiled, not via
      App Store, see section 4)
- [ ] Rate limiting on `/api/v1/pairing/start` itself (currently unlimited — a LAN attacker could
      keep generating fresh codes; low severity since each new code invalidates the previous one
      and only the desktop operator sees the code, but worth tightening later)
