# Integration Troubleshooting

This guide covers the three integrations Atlas supports today: Strava (OAuth), Health
Connect (Android bridge), and Samsung Health (Android bridge). It also covers the
optional Brave Search fallback used for nutrition lookups. Everything below is based on
the actual states and fields Atlas exposes in Settings, so you can match what you see on
screen to what's happening underneath.

All three integrations are configured from the same connector panel
(`apps/web/components/integration-connect-form.tsx`). The panel's own description of the
model is accurate and worth repeating: "each source keeps its real auth model: Strava
uses OAuth, Health Connect uses Android permissions, and Samsung Health uses SDK
consent."

## Strava (OAuth)

Strava is the only integration that uses a real OAuth handshake. It has three distinct
stages, and it's easy to get stuck between them without realizing it.

### Stage 1: Connect

Clicking Connect on Strava calls `POST /integrations/strava/connect`. This only marks
the integration as prepared locally (status moves off `disconnected`) — it does not talk
to Strava yet. If you supplied a login identifier (email or athlete name), it's recorded
as a note only, and Atlas prepends "Prepared OAuth handoff for &lt;identifier&gt;."

### Stage 2: Capture the callback

After you complete Strava's own authorization page in your browser, Strava redirects you
to a local callback URL with `code`, `state`, and `scope` query parameters attached. You
either paste the full redirected URL into the "Parse callback URL" field, or enter the
code/state manually.

**Symptom: "The pasted callback URL is missing a Strava code or state value."**
Likely cause: you pasted a URL from the wrong step (e.g., Strava's authorize URL instead
of the redirect target), or copied a truncated URL.
What to check: reload the Strava authorization flow and copy the *final* URL your
browser lands on after you approve access, in full, including everything after the `?`.

**Symptom: "Atlas could not parse that callback URL."**
Likely cause: the URL isn't a valid URL at all (extra whitespace, wrapped/broken line).
What to check: paste it into a plain text field first to confirm it's a single unbroken
URL, or fall back to entering the `code` and `state` fields manually — you can read both
off the same redirected URL.

**Symptom: server returns "Strava returned an OAuth error to the local callback URL."**
Likely cause: you denied the authorization request on Strava's consent screen, or the
callback URL includes an `error` query parameter.
What to check: retry Connect and make sure to click Authorize (not Cancel) on Strava's
page.

**Symptom: server returns "Provide a Strava callback URL or both the authorization code
and OAuth state."**
Likely cause: you tried to submit the capture step with neither a callback URL nor a
code/state pair filled in.
What to check: fill in one of the two input paths before submitting.

**Symptom: server returns "Strava OAuth state did not match the pending local
session."**
Likely cause: you started a new Connect attempt (which generates a fresh `state` token)
after already opening Strava's authorization page for a previous attempt, then tried to
capture the callback from the *old* page. The `state` value is single-use and tied to
whichever Connect click most recently ran.
What to check: start over — click Connect again, complete the authorization flow that
opens from that click, and capture that specific callback URL without switching tabs
back to an older attempt.

Once capture succeeds, Atlas reports `token_exchange_ready: true` and
`token_exchange_status: "authorization-code-captured"`. This means Atlas is holding a
Strava authorization code locally but has **not yet exchanged it for an access token**.
If you close the app or navigate away at this point, you are stuck in this
half-connected state — the runtime panel will show `token_exchange_ready` as true but
`token_ready` (built from `access_token_set`) as false.

### Stage 3: Exchange tokens

Click "Exchange tokens" to convert the captured code into a real access/refresh token
pair (`POST /integrations/strava/token-exchange`). On success,
`token_exchange_status` becomes `"token-ready"`, and the runtime panel shows
`access_token_set: true`, `refresh_token_set: true`, and `athlete_id`.

**Symptom: connector panel shows `token_exchange_ready: true` but `token_ready:
false`, and there's no error message.**
Likely cause: you captured the callback (stage 2) but never clicked "Exchange tokens"
(stage 3) — these are separate, deliberate steps.
What to check: click "Exchange tokens" explicitly. If it fails, the captured
authorization code may have expired (Strava codes are short-lived) — go back to Connect
and repeat the full flow.

**Symptom: `last_token_refresh_at` never updates, or sync fails after previously
working.**
Likely cause: the stored refresh token has expired or been revoked (e.g., you revoked
Atlas's access from your Strava account settings on strava.com).
What to check: disconnect and reconnect Strava from scratch.

### Sync

Once `access_token_set` is true, "Run live sync" calls `POST
/integrations/strava/sync`. If you click sync before connecting, the server raises
"Connect the integration before running a sync." — connect and complete the OAuth
exchange first.

### Disconnect

Disconnecting requires an explicit `{"confirm": true}` in the request — the UI's confirm
dialog exists because of this. The schema docstring is direct about why: disconnecting
is destructive, and requiring `confirm: true` "prevents an accidental or stray request
from silently discarding" the locally stored tokens and synced runtime data. There is no
undo — after disconnecting you'll need to run the full OAuth flow again to reconnect.

## Health Connect and Samsung Health (Android bridge integrations)

Both of these sync through the mobile companion app over your local network, not
through this desktop app directly (see `docs/mobile-architecture.md` for the pairing
protocol). Data lands via `POST /integrations/health_connect/device-sync` or
`POST /integrations/samsung_health/device-sync`, and — if you've paired a phone — those
endpoints require a valid pairing token from the paired-device check.

### Understanding `sync_mode` and `bridge_source`

- **`bridge_source`** identifies which underlying data channel supplied the sync
  payload. For Health Connect it's one of `health-connect-sdk`,
  `google-fit-health-connect`, or `manual-import`. For Samsung Health it's
  `samsung-health-sdk` or `manual-import`. If you see `manual-import`, the data did not
  come from the live Android bridge — someone (or some process) submitted it directly.
- **`sync_mode`** in the connector panel currently falls back to a stub value
  (`permissions-local-stub` for Health Connect, `sdk-local-stub` for Samsung Health) when
  no real value has been reported yet. If you consistently see the stub value even after
  running a sync from your phone, the bridge on the phone side likely isn't sending a
  real `sync_mode`, or the sync request never reached the desktop.

### Symptom: Connect succeeds instantly with no phone interaction

This is expected for the initial Connect step. Connecting `health_connect` sets
`permission_granted: true` and Samsung Health sets `sdk_consent_granted: true` in the
local runtime — but neither actually asks Android for permission at this stage, because
Connect only prepares the local runtime state. The real check happens on the phone side
when you run a sync from the companion app.

### Symptom: sync data never updates ("stub" numbers keep repeating)

Likely cause: the packaged Android adapters that talk to the real Health Connect /
Samsung Health SDKs are still integration points that data can flow through once wired
up on your phone — if your phone's companion app hasn't sent a device-sync request, the
desktop has nothing new to show, and you may still be looking at whatever was last
recorded (real or stub).
What to check: confirm your phone and desktop are on the same LAN and paired (see
`docs/mobile-architecture.md` for the pairing flow), then trigger a manual sync from the
companion app and watch `last_sync_at` on the integration for a fresh timestamp.

### Symptom: device-sync request is rejected

Likely cause: your phone isn't paired, or its pairing token has expired/been revoked.
What to check: re-pair the device from desktop Settings and try again.

### Disconnect

Same rule as Strava: `POST /integrations/{source}/disconnect` requires
`{"confirm": true}`, and it clears the locally stored runtime data (recent sessions,
hydration/weight/step counts for Health Connect; sleep/HR/energy/stress data for Samsung
Health) along with the connection state.

## Nutrition search fallback (Brave Search)

Atlas's primary nutrition data source is OpenFoodFacts, which needs no configuration.
Brave Search is an optional fallback, configured in Settings → Search with a
user-supplied Brave API key.

### No key configured

If `brave_api_key` is empty, Atlas never constructs the Brave provider at all — it's not
registered as a fallback, and OpenFoodFacts remains the only product data source. This
is not an error state; nutrition search simply has one fewer fallback. In Settings,
`brave_api_key_set` will show as `false`.

### Bad or revoked key

If a key is set but invalid or revoked, requests to Brave fail at the HTTP layer. Atlas
wraps these into an error like "Brave Search request failed: &lt;underlying error&gt;",
or, if Brave returns something unexpected, "Brave Search returned invalid JSON" /
"Brave Search returned a non-object JSON payload." These surface as fallback search
failures rather than crashing the main OpenFoodFacts lookup — nutrition search still
works, it just won't have Brave results.

What to check: verify the key in Settings → Search, generate a fresh key from your Brave
Search API account if needed, and re-save. If you no longer want to use it, clearing the
key (via the "clear" option in the settings update) removes it and Atlas falls back to
OpenFoodFacts-only, same as never having configured one.

### A privacy note specific to this fallback

Per the `SearchSettings` schema, the Brave key "is sent directly from this device to
Brave's API and nowhere else — never through an Atlas-hosted relay, never logged."
Search is entirely opt-in.
