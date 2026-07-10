# Recovery and Restore

This guide is for "something is wrong, how do I get back to a working state" situations. For the mechanics of taking and restoring a backup, see [docs/user-guide-backup-and-export.md](./user-guide-backup-and-export.md) — this doc links to that one instead of repeating it.

## Atlas won't start

On every startup, Atlas runs `validate_startup_config()` before it does anything else, specifically so a broken local setup fails with a clear message instead of a confusing crash. It checks two things:

**1. The local database and state directories must be writable.**

If Atlas can't create or write into the directory holding `local_db_path` or `local_state_path`, you'll see an error like:

```
Atlas cannot write to the directory for local_db_path ('<path>'). Set ATLAS_LOCAL_DB_PATH to a
writable location and restart Atlas. Original error: <OS error>
```

(or the same message with `local_state_path` / `ATLAS_LOCAL_STATE_PATH`). This tells you exactly which setting is broken. Common causes and fixes:

- **Permissions changed on the folder** — fix the folder's permissions, or point `ATLAS_LOCAL_DB_PATH` / `ATLAS_LOCAL_STATE_PATH` at a folder you know is writable.
- **Path points at a removable/network drive that isn't currently mounted** — reconnect the drive, or change the path to local storage.
- **The configured path itself is wrong** (e.g. a typo, or leftover config from a different machine) — correct it in your `.env` file (the `ATLAS_LOCAL_DB_PATH` / `ATLAS_LOCAL_STATE_PATH` variables).

**2. The configured API port must be a valid TCP port (1–65535).**

If `ATLAS_API_PORT` is set to something outside that range, you'll see:

```
ATLAS_API_PORT is set to <value>, which is not a valid TCP port (1-65535).
```

Fix: correct `ATLAS_API_PORT` in your `.env` file.

In both cases, the error names the exact setting and (for the storage case) the original underlying OS error, so you shouldn't need to guess — read the message, fix that one thing, and restart.

## Forgot your app-lock PIN

Be honest about this one: **there is no PIN reset or recovery flow.** Changing or disabling the app lock (`PUT /api/v1/app/lock`) requires supplying the *current* PIN whenever a lock is already enabled — the backend rejects the request with "The current PIN is required to change or disable the app lock" if you don't provide a correct current PIN. There's no reset link, no recovery code, no admin override.

If you're locked out, the only real path is a manual workaround: clear the app-lock fields directly from the local database.

1. Close Atlas completely (make sure the API process isn't running).
2. Open your local SQLite database (the file at your configured `local_db_path`, e.g. `apps/api/.local/atlas.db`) with any SQLite tool.
3. The app lock state lives inside the single JSON blob stored under the `shared_state` key in the `app_state` table. You'll need to edit that JSON and set the app lock's `enabled` field to `false` (and clear `pin_hash` / `salt`), then write the row back.
4. Restart Atlas. The app lock will now be off, and you can re-enable it with a new PIN from Settings.

This is a real, if blunt, manual fix — not a supported "forgot PIN" feature. If editing the SQLite row directly isn't something you're comfortable doing, restoring a backup taken *before* the lock was enabled (or before you last changed the PIN) also works, since app-lock state travels with backups — see the backup/export guide. Just know that a full import overwrites everything else in your app state, not just the lock.

## Database looks corrupted or locked

Atlas exposes real dependency health at `GET /api/v1/health` (not just "is the process up"). It runs an actual `SELECT 1` query against the SQLite connection and checks that the local state directory is writable, and reports:

```json
{
  "status": "ok" | "degraded",
  "checks": [
    { "name": "database", "ok": true/false, "detail": "..." },
    { "name": "local_state_directory", "ok": true/false, "detail": "..." }
  ]
}
```

`status` is `"degraded"` if either check fails. Look at the `detail` field for the failing check:

- **`database` check fails** — the detail will look like `SQLite at <path> did not respond: <sqlite3 error>`. This means the database file is locked or corrupted. Common cause: the database file sits inside a folder synced by OneDrive, Dropbox, or similar, and the sync client has the file locked or is mid-sync. Fix:
  1. Close Atlas.
  2. Check whether OneDrive/Dropbox (or another sync tool) is actively syncing that folder, and pause it or move the database out of any synced folder — SQLite files and cloud-sync folders don't mix well, since sync tools can lock or partially write the file while Atlas has it open.
  3. Restart Atlas and check `/api/v1/health` again.
  4. If the file is genuinely corrupted (sync tool partially overwrote it, disk error, etc.) and it still won't open, your only real option is restoring from a prior backup export — see the backup/export guide. If you don't have one, you'll need to let Atlas recreate a fresh database (move or delete the broken file, matching path, and restart) and reconfigure from scratch.

- **`local_state_directory` check fails** — the detail will say the directory doesn't exist or isn't writable, same underlying issue as the startup check above. Fix the folder's permissions or move `ATLAS_LOCAL_STATE_PATH` to a writable location.

## Moving Atlas to a new machine

This isn't a separate feature — it's just backup and restore applied across two machines:

1. On the old machine, export a backup (`GET /api/v1/backup/export`) and save the JSON somewhere you control.
2. Install and start Atlas fresh on the new machine.
3. Import the backup (`POST /api/v1/backup/import`) on the new machine.

See the [backup/export guide](./user-guide-backup-and-export.md) for the exact request shapes and, importantly, what does and doesn't survive the move. In particular: your AI provider API keys and Strava OAuth tokens are exported in OS-protected form and generally will **not** unprotect on the new machine (different OS keychain / different Windows account), so plan to re-enter your Ollama/Groq/Brave keys and reconnect Strava after importing. Sync history and planner generation history also don't carry over — only current state does.
