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

### LAN bind host (`desktop/electron/main.js`)

The sidecar binds to `127.0.0.1` by default, same as before. Set `ATLAS_ALLOW_LAN_PAIRING=1`
before launching Atlas to bind to `0.0.0.0` instead, making the API reachable from other devices
on the network. **There is deliberately no in-app toggle for this yet** — changing the bind
address requires restarting the sidecar, and a proper "restart to apply" UX wasn't built. This is
stated plainly as a real, current limitation, not glossed over.

**Threat model note**: binding to `0.0.0.0` means *any* device on the same local network can reach
the API, not just a phone with a valid pairing code. The pairing code (5-minute window) and device
token are the only things gating access to the pairing/sync endpoints specifically — other
endpoints (settings, chat, nutrition, etc.) remain reachable by anyone on the LAN once
`ATLAS_ALLOW_LAN_PAIRING=1` is set, matching Atlas's existing no-auth-on-loopback posture extended
to the LAN. Anyone wanting a stricter model should keep LAN pairing off except during an active
pairing session.

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
- [ ] In-app "restart to apply" UX for the LAN pairing toggle (currently env-var-only)
- [ ] iOS: `cap add ios`, HealthKit plugin, Apple Developer Program enrollment
- [ ] App icon / branding for the mobile app (Capacitor's default template icons are in place)
- [ ] Play Store / App Store listing and release process
