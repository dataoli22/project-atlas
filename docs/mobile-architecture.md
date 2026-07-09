# Mobile Architecture (Android now, iOS later)

Last updated: July 9, 2026

This document explains why the mobile app is architecturally different from the desktop Electron
shell, what's actually built and verified, and what's still open. It's the reference for anyone
touching `mobile/` or the backend pairing endpoints.

---

## 1. Why mobile can't just reuse the desktop sidecar model

Desktop packaging (`docs/packaging-and-installation.md`) works by having Electron spawn the
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
TypeScript errors), and `npx cap add android` produced a structurally correct native project.

**What's explicitly NOT verified**: this environment has no Android SDK, no Gradle toolchain
beyond what npm installed, no JDK 17+ (only JDK 8 present), and no emulator or device. **No `.apk`
has been built or run.** See section 3.

Screens (`mobile/src/App.tsx`):
- **Pair screen**: enter the desktop's LAN address, test connectivity
  (`GET /api/v1/health`), enter the pairing code and a device name, confirm pairing.
- **Sync screen**: shows pairing status, a "Send test sync" button that calls the real
  `device-sync` endpoint with an **empty** payload (exercises the full pairing + auth + sync
  wiring without depending on Health Connect data collection, which isn't implemented — see
  below), and an unpair button.

Pairing state persists on-device via `@capacitor/preferences` (`mobile/src/pairing-store.ts`) —
the desktop base URL, device ID, and device token, never synced anywhere else.

### Health Connect data collection — NOT implemented

`mobile/src/health-connect-plugin.ts` defines the intended plugin interface
(`isAvailable`/`requestPermissions`/`readRecentSessions`/`readHydrationMl`/`readBodyWeightKg`/
`readStepCount`) and documents exactly what native Android work remains: add the Health Connect
SDK dependency, declare permissions, implement a Kotlin `HealthConnectPlugin` handling the runtime
permission flow and `HealthConnectClient.readRecords()` calls, map record types into the
`HealthConnectSession`/`SyncPayload` shapes already defined in `desktop-api.ts`. This was
deliberately scaffolded rather than implemented blind, since there's no way to test native Android
health SDK code in this environment — writing it without any way to verify permission flows or
data shapes against a real device would be guessing, not engineering.

---

## 3. What you need to actually build and run this

Since this environment has no Android SDK, no compatible JDK, and no device/emulator, someone with
real Android tooling needs to:

1. Install **Android Studio** (bundles a compatible JDK and the SDK) or the standalone
   command-line tools + a JDK 17+.
2. `cd mobile && npm install && npm run cap:android` — builds the web assets, syncs them into the
   native project, and opens Android Studio.
3. Run on a device or emulator with Health Connect installed (Android 14+ has it built in;
   earlier versions need the Health Connect app from Play Store).
4. Implement the native `HealthConnectPlugin.kt` per the TODO in `health-connect-plugin.ts`.
5. Test the full flow: launch desktop with `ATLAS_ALLOW_LAN_PAIRING=1`, start pairing in
   Settings → Phone pairing, pair the phone, grant Health Connect permissions, sync real data.

---

## 4. iOS (blocked, not started)

Building for iOS requires **Xcode running on macOS**, plus an **Apple Developer Program**
enrollment ($99/year) for device testing, TestFlight, and App Store distribution. Neither is
available in this environment — this is a hard tooling blocker, not a scope decision.

Once macOS + Xcode access exists: `npx cap add ios` from `mobile/` generates the native iOS
project the same way `cap add android` did here. The `desktop-api.ts`/`pairing-store.ts`/UI layer
is already platform-agnostic (Capacitor abstracts `Preferences` across platforms). The
HealthKit-equivalent of `health-connect-plugin.ts` still needs to be written and implemented
natively in Swift — same shape, different native APIs (HealthKit's `HKHealthStore` instead of
Health Connect's `HealthConnectClient`).

---

## 5. Open items

- [ ] Real Android build + device/emulator test (needs Android Studio + JDK 17+ on a real machine)
- [ ] Native `HealthConnectPlugin.kt` implementation
- [x] In-app "restart to apply" UX for the LAN pairing toggle — done, see section 2
- [x] Pairing code brute-force protection — done, see section 2
- [x] Mobile sync retry/backoff on transient network failures — done, see section 2
- [ ] iOS: `cap add ios`, HealthKit plugin, Apple Developer Program enrollment
- [ ] App icon / branding for the mobile app (Capacitor's default template icons are in place)
- [ ] Play Store / App Store listing and release process
- [ ] Rate limiting on `/api/v1/pairing/start` itself (currently unlimited — a LAN attacker could
      keep generating fresh codes; low severity since each new code invalidates the previous one
      and only the desktop operator sees the code, but worth tightening later)
