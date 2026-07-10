# Backup and Export

Atlas stores everything locally on your machine (SQLite database, no cloud sync). This guide explains exactly what a backup contains, what it deliberately leaves out, and how to export and restore one.

There is currently no dedicated "Backup" section in the Settings UI — this is a raw API feature you call directly (browser, `curl`, or the interactive API docs at `http://127.0.0.1:8000/docs`). If that changes, this doc will be updated.

## What gets exported

Backups are produced by `GET /api/v1/backup/export` and restored with `POST /api/v1/backup/import`.

An export is a single JSON object shaped like this:

```json
{
  "backup_format_version": 1,
  "exported_at": "2026-07-09T12:00:00+00:00",
  "app_state": { "...": "..." }
}
```

`app_state` is a dump of the single `shared_state` row Atlas keeps in its local SQLite database (`SharedStateStore.export_all()` reads every row currently in the `app_state` table, but in practice Atlas only ever writes one key there — `shared_state`). That blob includes:

- **Profile** — primary goal, profile type, activity level, body weight, hydration target
- **Localization** — market, currency, language, and any overrides
- **App preferences** — active feature, enabled feature flags, shell density
- **AI settings** — provider choice, model names, prompt profiles, local-only-mode flag
- **Integrations** — connection status/metadata for Strava, Health Connect, Samsung Health
- **Integration runtime state** — including your Strava OAuth tokens (see "Secrets" below)
- **Nutrition runtime** — swap history, pantry items, last/next refresh timestamps
- **App lock** — whether the lock is enabled, and the PIN hash/salt/iteration count (see the warning below)
- **Pairing state** — pending pairing codes and the list of paired devices

### What is NOT included

Two things live in separate SQLite tables and are **not** touched by export/import at all:

- **Sync history** (`connector_sync_history` — the log entries you see via `/api/v1/history/sync`)
- **Planner generation history** (`planner_generation_history` — `/api/v1/history/planner`)

If you restore a backup, your sync/planner history logs are left exactly as they are on the machine you're importing into — they're neither wiped nor restored from the backup.

## Secrets: what's in the file, and what that means

Your Ollama, Groq, and Brave API keys, and your Strava OAuth access/refresh tokens, **are included in the export** — but never in plaintext. They're stored using OS-native protection (Windows DPAPI, macOS Keychain, or libsecret on Linux) and exported in that already-protected form (e.g. `ollama_api_key_protected`, `groq_api_key_protected`, `brave_api_key_protected`, `access_token_protected` / `refresh_token_protected` for Strava).

Practically, this means:

- **The backup file is not a "share this with anyone" artifact.** It contains your credentials in protected form, and mishandling it is a real risk even though the values aren't plaintext.
- **A DPAPI-protected backup only unprotects on the same Windows user account that created it.** Moving a backup from one Windows machine/account to another means those secrets will simply fail to unprotect — you'll need to re-enter your API keys and reconnect Strava after import.
- **macOS Keychain / libsecret-protected secrets only unprotect on the machine that created them.** Same caveat applies across OSes.
- In short: backups move state between *your own devices* reliably, but secrets travel only as far as the OS-level protection they're tied to. Treat the export file itself as sensitive — store it somewhere only you can access (not a shared drive or unencrypted cloud folder).

Your app-lock PIN hash/salt is also in the backup. Importing an old backup restores the PIN that was active when that backup was taken — see the recovery guide for what that means if you've since changed or forgotten your PIN.

## How to export

Send a `GET` request to `/api/v1/backup/export` (e.g. `http://127.0.0.1:8000/api/v1/backup/export`, or via the interactive docs at `/docs`). Save the JSON response to a file. That file is your entire backup — there's nothing else to collect.

## How to import

Send a `POST` request to `/api/v1/backup/import` with the exact JSON body an export produced (same three keys: `backup_format_version`, `exported_at`, `app_state`).

Import behavior, read directly from `SharedStateStore.import_backup()`:

- **`backup_format_version` must equal `1`.** Any other value (including a missing one) is rejected with a 400 error and nothing is changed. There's currently only one format version, so this only matters for future compatibility.
- **Import overwrites, it does not merge.** Every key present in the backup's `app_state` is written straight into the local database, replacing whatever was there. Since the export only ever contains one key (`shared_state`), in practice a full import replaces your entire profile/preferences/integrations/ai-settings/app-lock/pairing state with the backup's version in one shot.
- The running app reloads its in-memory state from the database immediately after import — no restart needed.
- Sync history and planner generation history (see above) are untouched by import, regardless of what's in the backup.

There is no partial/selective import — it's all or nothing for whatever `app_state` the backup contains.

## Related

For "something's actually broken and I need to recover" scenarios (corrupted database, forgotten PIN, moving to a new machine), see [docs/user-guides/recovery-and-restore.md](./recovery-and-restore.md).
