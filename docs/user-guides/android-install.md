# Installing the Atlas Android companion app

The Android app is a companion, not a standalone app. It doesn't run its own copy of the Atlas backend - it collects data from Health Connect on your phone and syncs it to a desktop computer running Atlas, over your local network. There's no cloud relay involved, and the phone is only useful when a paired desktop is reachable on the same LAN.

## Current state: this is a development build, not a released app

Be honest with yourself about what you're getting into: there is no Play Store listing, and none is planned right now. The APK has to be built from source, and as of this writing it has only been built and run through `assembleDebug` locally - it has not been installed and exercised on a real phone or emulator yet. App icon and branding are still the default Capacitor placeholders. If you're not comfortable building an Android app from source, this isn't ready for you yet.

## Building the APK

The Capacitor project lives in `mobile/` in the repository. From a machine with Node.js and Android Studio (SDK + JDK) installed:

1. `cd mobile`
2. `npm install`
3. `npm run cap:android` - this builds the web assets, runs `npx cap sync`, and opens the native project in Android Studio.
4. From Android Studio, build and run on a device or emulator, or from the command line: `cd mobile/android && ./gradlew assembleDebug`, which produces an APK at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
5. Install that APK on your phone (you'll need to allow installs from unknown sources, since it's not signed/distributed through a store).

Android 14+ has Health Connect built in. On older versions you'll need to install Health Connect from the Play Store separately.

## Pairing your phone with a desktop

Pairing is LAN-only - your phone and your computer need to be on the same network. Here's how it actually works, step by step:

1. On the desktop app, go to **Settings -> Phone pairing** and turn on **"Allow phone pairing on this network."** This requires restarting Atlas to take effect (you'll see a prompt to do so). By default Atlas only listens on `127.0.0.1` (not reachable from other devices) - this toggle switches it to listen on all network interfaces so your phone can reach it.
2. Still on the desktop, start pairing. Atlas generates a 6-digit numeric pairing code and shows you the desktop's LAN address(es) and port. The code is valid for 5 minutes.
3. On the phone app, enter the 6-digit code and a name for this device.
4. The desktop verifies the code and, if it matches, hands the phone a long-lived device token (shown once - the phone stores it for future requests). The pairing code itself only allows 5 guesses before it's invalidated and you have to generate a new one.
5. Once paired, the phone can be revoked at any time from desktop Settings -> Phone pairing -> your paired devices list.

There is no cloud server or Atlas-hosted relay anywhere in this flow - the code exchange and all data sync happen directly between your phone and your desktop over the LAN.

Security note worth knowing: turning on "Allow phone pairing on this network" exposes the whole local API to your LAN, not just the pairing endpoints - only the pairing and sync endpoints themselves are protected by the pairing code / device token. Only enable it on networks you trust, and turn it off again if you don't need it.

## What data actually syncs

When your phone syncs to the desktop, it sends whichever of the following it has collected via Health Connect (or, on the Samsung Health path, Samsung Health data):

**From Health Connect:**
- A device label and the sync source (Health Connect SDK, Google Fit via Health Connect, or manual import)
- Recent workout/activity sessions (type, duration, distance, start date, source) - up to 50 at a time
- Hydration (mL)
- Body weight (kg)
- Step count
- Active energy burned (kcal)

**From Samsung Health (if used):**
- A device label and sync source
- Recent sessions (same shape as above)
- Sleep hours
- Resting heart rate
- Energy score
- Stress level

All of this lands in the same local SQLite database as your desktop data - nothing is sent anywhere except to your own paired desktop.
