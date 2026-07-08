# Local Packaging and Security Runbook

Project Atlas is intended to be downloaded and run locally on desktop or Android without a mandatory hosted Atlas cloud.

## Current MVP Status

The repository currently has a Next.js web app and a FastAPI local backend, but it does not yet include a native desktop or Android wrapper. That means the product can be run locally for development, but it is not yet packaged as a one-click desktop installer or Android APK/AAB.

## Test Gate After Merge

Run this after all worker branches are merged:

```bash
npm install
pip install -r apps/api/requirements.txt
npm run test:all
```

`npm run test:all` runs:

- API pytest suite
- web lint and production build
- Playwright production E2E smoke tests

## Security Gate

Install Python security tooling once:

```bash
pip install -e "apps/api[security]"
```

Then run:

```bash
npm run security
```

Security checks include:

- `npm audit --audit-level=moderate`
- `pip-audit -r apps/api/requirements.txt`
- `bandit -r apps/api/app`

Current known npm audit state: Next.js currently pulls a vulnerable `postcss` advisory at moderate severity. `npm audit fix --force` proposes a breaking Next downgrade, so do not apply it automatically. Track this by upgrading Next when a compatible patched release is available.

## Desktop Packaging Target

Recommended desktop approach for the MVP:

1. Use Tauri v2 or Electron as the desktop shell.
2. Build the Next.js app in production mode.
3. Package the FastAPI backend as a local executable with PyInstaller.
4. Start the backend on `127.0.0.1` using a local-only random or configured port.
5. Start or serve the web UI locally and point it at the local API.
6. Store all user data under the OS user data directory.
7. Treat Ollama as a local dependency that the app detects and helps configure, not as a hosted Atlas service.

Security requirements:

- Bind local services to loopback only.
- Never expose API keys in frontend bundles.
- Keep Groq optional and user configured.
- Store secrets in OS keychain or encrypted local storage.
- Ship signed installers for Windows/macOS/Linux before public distribution.

## Android Packaging Target

Android packaging is a larger implementation task because the current backend is Python/FastAPI.

Viable options:

- Preferred long-term: Android native shell with a small local API implemented in Kotlin/SQLite or a shared Rust core.
- Short-term proof of concept: native Android WebView shell plus embedded Python through Chaquopy or python-for-android, running the FastAPI service on loopback.
- PWA-only fallback: installable browser app, but this does not satisfy fully self-contained local backend packaging.

Security requirements:

- Do not require a hosted Atlas API.
- Keep all health data on device unless the user explicitly configures an external provider.
- Use Android Keystore for secrets.
- Restrict cleartext traffic to loopback only if a local HTTP bridge is used.
- Document any external provider calls such as Strava, Samsung Health, Health Connect, Ollama, or Groq.

## Release Readiness Checklist

- `npm run release:check` passes on a clean checkout.
- Desktop installer starts web and API locally without a terminal.
- Android APK/AAB starts local UI and local runtime on device.
- App works offline except for user-enabled external integrations.
- Dependency audit has no unresolved high or critical findings.
- Moderate findings have documented risk acceptance or upgrade plan.
- Static security scan has no unresolved high-confidence findings.
- No generated folders such as `.next`, `e2e/test-results`, or cache folders are committed.
