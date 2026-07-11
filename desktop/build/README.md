# Desktop build resources

`icon.ico` (Windows) and `icon.png` (Linux/macOS fallback, 512x512) are generated from the
single source-of-truth brand mark at `assets/brand/atlas-mark.svg` - run
`node scripts/generate-app-icons.mjs` from the repo root to regenerate both after changing the
source SVG. Referenced from `desktop/package.json`'s `build.win.icon`/`build.mac.icon`/
`build.linux.icon`.

Still missing: a real `icon.icns` for macOS (needs `iconutil`, a macOS-only tool - not
generatable from this Windows machine). `icon.png` is set as the mac icon in the meantime, which
electron-builder accepts but isn't a proper multi-resolution `.icns` bundle icon. Matches the
existing "never built on macOS from this machine" caveat in `docs/production-todo.md` section 9.
