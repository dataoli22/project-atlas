# Installing Atlas on Windows

Atlas is a self-hosted health/fitness app. This guide covers installing the desktop app on Windows, where your data ends up, and what to expect from updates.

macOS and Linux builds are zip-only right now (no installer) - packaging for those platforms is configured but not actively built or tested, so this guide is Windows-only for now.

## Where to download it

Installers are published as GitHub Releases on `dataoli22/project-atlas`. Go to the repository's Releases page and download the `.exe` installer for the version you want (named something like `Atlas Setup <version>.exe`).

There is no other download location - no website, no app store listing.

## Installing

The installer is a standard NSIS installer, not a "one-click" install. When you run it, you'll be able to:

- Choose the install directory (it's not locked to a fixed path)
- Get a desktop shortcut created automatically

Just run the downloaded `.exe` and follow the prompts.

### About the SmartScreen warning

Atlas isn't code-signed yet - there's no certificate configured, because getting one is a business/cost decision that hasn't been made, not a technical limitation. That means Windows SmartScreen will very likely show an "unrecognized app" warning when you run the installer.

If you trust the source you downloaded it from (the official GitHub Releases page), you can proceed past the warning (usually "More info" -> "Run anyway"). This is a known, deferred gap, not an oversight - it'll be revisited if/when a signing certificate is set up.

## First launch

On first launch, Atlas starts its own local API process in the background (a bundled FastAPI sidecar) and opens its window pointed at it. There's no separate server to start yourself, and no account to sign into - everything runs on your machine.

## Where your data lives

Atlas stores everything under your Windows per-user AppData folder, specifically in an `Atlas` folder inside `%APPDATA%` (i.e. `AppData\Roaming\Atlas`). Inside that folder you'll find:

- `atlas.db` - your local SQLite database (all your health/fitness data)
- `shared-state.json` - shared runtime state
- `desktop-prefs.json` - desktop app preferences (like the phone-pairing LAN toggle)

This is entirely local and per-machine. Nothing is uploaded anywhere, and nothing is shared with the developer. If you install Atlas on a second computer, it starts with a fresh, empty database there - your data doesn't follow you automatically (there's no cloud sync built in).

## Updates

Atlas has auto-update wiring built in (via `electron-updater`, pointed at the same GitHub Releases feed you downloaded the installer from). When you launch a packaged build, it checks for updates in the background automatically - no button to press.

Be aware: as of this writing, that update path has been wired up but has not yet been exercised against a real published release, so treat it as unproven. If you don't see it prompt you for an update, the safest fallback is to check the Releases page yourself and download the newer installer manually.
