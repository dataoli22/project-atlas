# Atlas

Atlas is a local-first, self-hosted health and fitness app for two modules:

- **Endurance and Capability** — training, recovery, and capability tracking
- **Nutrition and Meal Planning** — weekly meal plans, shopping lists, and cooking flow

Everything runs on your own machine. There's no account to create, no cloud backend, and no
Atlas-hosted server in the loop — your data, provider API keys, and AI conversations stay on
your device unless you explicitly configure a cloud AI provider (Groq) or connector (Strava),
in which case only that specific traffic goes directly from your device to that provider, never
through Atlas.

## Download

**[Download the latest Windows installer from Releases](https://github.com/dataoli22/project-atlas/releases/latest)**

Run the downloaded `.exe` and follow the installer prompts. Windows SmartScreen will likely warn
that the app isn't recognized — this is because it isn't code-signed yet, not because anything is
wrong; see the install guide below for what to do.

macOS and Linux builds are configured but not yet published — Windows is the only actively
supported platform right now.

There's also an Android companion app for syncing Health Connect/Samsung Health data over your
local network, currently a developer build (not on the Play Store) — see the Android install
guide below.

## Setting up

New to Atlas? Read these in order:

1. **[Installing on Windows](docs/user-guides/desktop-install.md)** — where to download it,
   what to expect from the installer, and where your data ends up.
2. **[First-run Ollama setup](docs/user-guides/ollama-first-run.md)** — Atlas can use a free local
   AI model (Ollama) or a cloud provider (Groq); this walks through getting either one working.
3. **[Android companion app install](docs/user-guides/android-install.md)** — optional, for
   syncing workout/recovery data from your phone over your local network.

## Using Atlas day to day

- **[Integration troubleshooting](docs/user-guides/integration-troubleshooting.md)** — fixing
  Strava, Health Connect, Samsung Health, or the nutrition search fallback when something isn't
  syncing right.
- **[Data retention & privacy](docs/user-guides/data-retention-and-privacy.md)** — exactly what's
  stored, where, what (if anything) ever leaves your device, and how to delete everything.
- **[Backup & export](docs/user-guides/backup-and-export.md)** — how to export your data and
  restore it.
- **[Recovery & restore](docs/user-guides/recovery-and-restore.md)** — what to do if Atlas won't
  start, the database looks broken, or you're moving to a new machine.

## Project status

Atlas is a solo, actively-developed project. Current status, what's done, and what's still open
is tracked in [`docs/production-todo.md`](docs/production-todo.md).

## For developers

All technical documentation lives under [`docs/`](docs), grouped by purpose:

- **Build & run**: [`packaging-and-installation.md`](docs/build-and-run/packaging-and-installation.md) (local
  dev setup, desktop/Android packaging, release gates) ·
  [`ollama-on-device-and-agents.md`](docs/build-and-run/ollama-on-device-and-agents.md) (AI runtime wiring,
  provider fallback chain) · [`agent-prompt-maintenance-guide.md`](docs/build-and-run/agent-prompt-maintenance-guide.md)
  + [`prompt-changelog.md`](docs/build-and-run/prompt-changelog.md) (changing agent prompts/guardrails)
- **Feature specs (current)**: [`nutrition-endurance-feature-spec.md`](docs/feature-specs/nutrition-endurance-feature-spec.md)
  (refresh/calendar/prep-hacks, endurance support links) ·
  [`mobile-architecture.md`](docs/feature-specs/mobile-architecture.md) (companion mobile app, pairing,
  Android/iOS status)
- **Original design docs (historical — superseded by the feature specs above and the backlog
  below, kept for design-stage context)**:
  [`master-product-architecture.md`](docs/historical/master-product-architecture.md) ·
  [`prd-feature-1-endurance-capability.md`](docs/historical/prd-feature-1-endurance-capability.md) ·
  [`prd-feature-2-nutrition-cooking-cost.md`](docs/historical/prd-feature-2-nutrition-cooking-cost.md)
