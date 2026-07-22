# Installing the Atlas Android companion app

The Android app is a companion, not a standalone app. It doesn't run its own copy of the Atlas backend - it collects data from Health Connect on your phone and syncs it to a desktop computer running Atlas, over your local network. There's no cloud relay involved, and the phone is only useful when a paired desktop is reachable on the same LAN.

## Current state

There is no Play Store listing, and none is planned right now - the signed APK is published
directly to GitHub Releases instead (see `.github/workflows/android-release.yml`), which is what
the QR-code install flow below points at. You do **not** need to build from source or use Android
Studio just to install and use the app. The pairing flow itself has been verified end-to-end on a
real Android emulator (real pairing code exchange, real Health Connect permission prompt); it has
not yet been run through on a physical phone. App icon and branding are still the default Capacitor
placeholders.

## Installing the app

### Recommended: scan the QR code from the desktop app (no developer tools needed)

This is the path for everyone who isn't building from source. It does **not** require enabling
Developer options or Wireless debugging - those are only needed for the ADB path further down.

1. Connect your phone to the **same Wi-Fi network** as the desktop running Atlas. This is a real
   requirement of the pairing protocol (see below), not just of installing the app - do this
   first so you don't have to redo the QR scan afterward.
2. On the desktop, go to **Settings -> Setup -> Pair your device** and turn on **"Allow phone
   pairing on this network."**
3. Tap **"Start pairing a phone"** and scan the QR code with your phone's camera app (not from
   inside a browser or Atlas Companion itself).
   - **If Atlas Companion isn't installed yet**, the QR code takes you to its GitHub Releases
     download page. Download the APK, open it, and Android will prompt you to confirm **"install
     from unknown sources"** - this one confirmation is unavoidable for an app that isn't
     distributed through the Play Store, but it's the only manual step. Once installed, go back to
     the desktop and scan the same QR code again - this time it opens straight into pairing with
     the address and code already filled in.
   - **If Atlas Companion is already installed**, the QR code opens it directly into pairing,
     nothing to download.

Android 14+ has Health Connect built in. On older versions you'll need to install Health Connect
from the Play Store separately.

### Advanced: install via ADB (developer tools, no QR code)

For anyone who prefers a terminal, or is installing a debug build straight from a local build
output rather than a GitHub release. Requires [adb](https://developer.android.com/tools/adb) on
your computer's PATH.

**Over USB** (phone connected by cable, USB debugging enabled in Developer options):

```
adb install -r app-debug.apk
```

**Wirelessly, Android 11+** (no cable): enable Developer options (tap Build number 7 times in
Settings -> About phone), then Settings -> Developer options -> Wireless debugging -> "Pair device
with pairing code". That screen shows an IP, a pairing port, and a 6-digit code. Then, from your
computer:

```
adb pair <phone-ip>:<pairing-port>   # enter the 6-digit code when prompted
adb connect <phone-ip>:<debugging-port>
adb install -r app-debug.apk
```

Developer options and Wireless debugging are Android's settings for *this* ADB install method
only - they have nothing to do with the QR-code path above, and aren't needed if you use that
instead.

### Building the APK from source

The Capacitor project lives in `mobile/` in the repository. From a machine with Node.js and Android Studio (SDK + JDK) installed:

1. `cd mobile`
2. `npm install`
3. `npm run cap:android` - this builds the web assets, runs `npx cap sync`, and opens the native project in Android Studio.
4. From Android Studio, build and run on a device or emulator, or from the command line: `cd mobile/android && ./gradlew assembleDebug`, which produces an APK at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
5. Install that APK using either method above.

## Pairing your phone with a desktop

Pairing is LAN-only - your phone and your computer need to be on the **same Wi-Fi network**. This
is a hard requirement, not a suggestion: there is no cloud relay, so if the two devices can't reach
each other directly on the local network, pairing cannot work no matter how the app was installed.
Here's how it actually works, step by step:

1. On the desktop app, go to **Settings -> Setup -> Pair your device** and turn on **"Allow phone
   pairing on this network."** This requires restarting Atlas to take effect (you'll see a prompt
   to do so). By default Atlas only listens on `127.0.0.1` (not reachable from other devices) -
   this toggle switches it to listen on all network interfaces so your phone can reach it.
2. Still on the desktop, start pairing. Atlas generates a 6-digit numeric pairing code and shows
   you the desktop's LAN address(es), port, and a QR code encoding all three.
3. On the phone, either scan that QR code (see "Installing the app" above - it fills the address
   and code in automatically) or open the app and enter the address and 6-digit code by hand, plus
   a name for this device.
4. The desktop verifies the code and, if it matches, hands the phone a long-lived device token (shown once - the phone stores it for future requests). The pairing code itself only allows 5 guesses before it's invalidated and you have to generate a new one.
5. Once paired, the phone can be revoked at any time from desktop Settings -> Setup -> Pair your device -> your paired devices list.

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
