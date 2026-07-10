# Data Retention & Privacy

Atlas is a local-first, single-user app. This page states, as precisely as the code
allows, what data exists, where it lives, what leaves your device, and how to delete all
of it. For how to export/import a backup, see
[`docs/user-guides/backup-and-export.md`](./backup-and-export.md) — this page
covers storage and privacy, not the export format.

## Where your data lives

Atlas stores its state in two places on your device:

1. **A SQLite database and a JSON state file**, at paths controlled by the
   `ATLAS_LOCAL_DB_PATH` and `ATLAS_LOCAL_STATE_PATH` environment variables
   (`apps/api/app/core/config.py`). By default (running the API directly) these default
   to `apps/api/.local/atlas.db` and `apps/api/.local/shared-state.json`.
2. **An OS-native secret store**, used only for provider API keys and OAuth tokens (see
   below) — this data is deliberately kept out of the SQLite file.

When you run Atlas as the packaged desktop app, Electron overrides both paths per user.
In `desktop/electron/main.js`, the Electron main process sets:

```
ATLAS_LOCAL_DB_PATH = <userData>/atlas.db
ATLAS_LOCAL_STATE_PATH = <userData>/shared-state.json
```

where `<userData>` is `app.getPath("userData")` — the OS-standard per-user application
data folder (on Windows, this is under `%APPDATA%\Atlas`; the app explicitly calls
`app.setName("Atlas")` so this folder is named cleanly rather than deriving from the
internal npm package name). Because this path is per-OS-user, two different Windows/Mac
accounts on the same machine each get their own isolated Atlas data — nothing is shared
between OS user profiles.

At startup, Atlas fails fast if it can't write to either path (`validate_startup_config`
in `config.py` does a probe write/delete and raises a clear error naming the offending
path and environment variable) — so if Atlas starts successfully, you can trust it's
actually using the paths described above.

## What's stored where, and how

### In the SQLite database / JSON state file

Your logged workouts, nutrition entries, planner history, sync history, and general app
settings live here. This file is not encrypted by Atlas — protect it the same way you'd
protect any personal file on your machine (disk encryption, OS account password, etc.).

### In the OS-native secret store, not in the database

Provider API keys and OAuth tokens are handled by `LocalSecretProtector`
(`apps/api/app/features/shared/services/secure_storage.py`), which picks the strongest
available option for your OS:

- **Windows**: DPAPI (`dpapi` scheme) — encrypted with a key tied to your Windows user
  account, via `CryptProtectData`.
- **macOS**: Keychain (`keychain` scheme) — the secret is stored in the macOS Keychain
  itself (via the `security` CLI); the database only holds a non-secret reference to the
  Keychain entry name.
- **Linux**: libsecret (`libsecret` scheme) — the secret is stored in your OS secret
  vault (via `secret-tool`); same non-secret-reference pattern as Keychain.
- **Fallback**: if none of the above is available (missing CLI tool, vault locked,
  subprocess error), Atlas falls back to a weaker `base64-fallback` scheme rather than
  refusing to start. This is not real encryption — it's an obfuscation-only fallback so a
  broken OS vault never blocks the app. The scheme actually used for a given secret is
  recorded alongside it, so this isn't hidden from anyone inspecting the storage layer.

Secrets protected this way include: Strava's OAuth access and refresh tokens, and your
Groq/Ollama/Brave provider API keys where applicable. None of these are ever written to
the SQLite database or the JSON state file in plaintext.

## What never leaves your device

- **Provider API keys** (Groq, Brave). Stored as described above; never logged, never
  sent anywhere except directly to the provider whose key it is.
- **Chat prompts, chat history, and AI-generated content.** The `DEVICE_NOTICE` shown in
  Settings states this directly:

  > "Provider keys and prompts stay on this device and are sent directly to whichever
  > provider you configure - Atlas never routes them through a hosted relay. By default
  > Atlas prefers a cloud provider once you add a key (Groq's free tier, or Ollama
  > pointed at a cloud endpoint) for speed and capability, and automatically falls back
  > to on-device Ollama if that call fails. Enable local-only mode for a hard guarantee
  > that nothing ever leaves this device."

  In other words: by default, if you've added a cloud provider key, your prompts do
  leave the device — to that provider directly, never to any Atlas-operated server —
  and Atlas automatically falls back to local Ollama if that call fails. If you want a
  hard guarantee nothing ever leaves the device, enable local-only mode in Settings.
- **Mobile pairing**: the Android companion app talks to the desktop only over your
  local network — there is no cloud relay or push mechanism for pairing or sync (see
  `docs/feature-specs/mobile-architecture.md`).

## What does leave your device, and to where

Atlas calls a small, fixed set of external hosts directly from your device — never
through any Atlas-operated relay:

| Host | Purpose | Configurable? |
|---|---|---|
| Your configured Ollama endpoint (default `http://localhost:11434`, can point to a remote/cloud Ollama) | Local or self-hosted LLM inference | Yes — default is local-only |
| Groq API | Cloud LLM inference, if you add a Groq key | Opt-in (add key) |
| `api.search.brave.com` | Optional nutrition search fallback, if you add a Brave key | Opt-in (add key) |
| `world.openfoodfacts.org` | Primary nutrition product data source | Always used for nutrition lookups (no key required) |
| Strava's API and OAuth endpoints | Only if you connect the Strava integration | Opt-in (connect integration) |

Each of these is called directly with whatever credentials you've configured for it —
Atlas does not proxy, log, or relay these calls through any server it operates. If you
never add a Groq key, never connect Strava, and never add a Brave key, and Ollama is
pointed at `localhost`, the only outbound call Atlas makes on your behalf is to
OpenFoodFacts for nutrition lookups. Enabling local-only mode removes the AI-provider
fallback behavior described above, forcing all AI calls to local Ollama.

## How to fully delete all local data

Because everything lives at the paths described above, deleting all Atlas data is a
matter of removing those files/folders:

1. **Quit Atlas completely** (desktop app and any running API sidecar).
2. **Delete the database and state file.** If running the packaged desktop app, delete
   the entire Atlas `userData` folder — the OS-standard per-user app data directory
   Electron reported (on Windows, this is the `Atlas` folder under `%APPDATA%`, thanks to
   the `app.setName("Atlas")` fix mentioned above). If running the API directly with
   custom `ATLAS_LOCAL_DB_PATH` / `ATLAS_LOCAL_STATE_PATH` values, delete whatever
   files those environment variables point at.
3. **Remove secrets from the OS-native store.** Deleting the database/state file does
   *not* remove keys stored in DPAPI/Keychain/libsecret, since those live in the OS
   vault, not in Atlas's own files. On Windows, DPAPI-protected blobs are stored inside
   the state file itself, so step 2 covers them. On macOS/Linux, use Keychain
   Access.app or `secret-tool` respectively to remove entries prefixed `atlas-` (service
   prefix `atlas-`, labels prefixed `"Atlas "`) if you want to be thorough — Atlas does
   not currently provide an in-app "delete all OS secrets" action, so this step is
   manual.

There is no server-side copy anywhere to also clean up — Atlas has no backend other than
the local sidecar you just deleted the data for.

## The app-lock PIN: what it actually protects against

Settings includes an optional PIN ("app lock") for shared devices. Its own schema
docstring is explicit about the limits of what this is, and this guide preserves that
framing rather than overstating it:

> "Atlas is single-user and local-only: this is a device-level access deterrent for
> shared computers, not a real authentication/session system. There is no server, no
> account, and no password recovery - if a user forgets their PIN, the only path is
> disabling it via direct local file/database access, which is by design for a
> local-first app."

Practically, this means:

- The PIN deters casual access on a shared computer (e.g., a family member opening the
  app). It is **not** encryption of your data — the underlying database and state file
  are not protected by the PIN.
- The PIN is hashed one-way with PBKDF2-HMAC-SHA256 (200,000 iterations) for local
  verification only — Atlas cannot show you your PIN back, and there is no recovery
  flow.
- If you forget your PIN, the only way back in is to disable app-lock by directly
  editing the local database/state file — there is no "forgot PIN" flow, by design,
  because there is no account or server to verify against.
- Anyone with direct file access to your device already has access to your data with or
  without the PIN set — it does not add a layer against someone who can read the
  database file directly.

If you need real protection against someone with physical access to your machine, rely
on full-disk encryption and your OS account password, not the app-lock PIN.
