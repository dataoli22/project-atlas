# Desktop build resources

Place platform icons here when real branding assets exist:

- `icon.ico` (Windows, referenced from `desktop/package.json`'s `build.win.icon` once added)
- `icon.icns` (macOS)
- `icon.png` (Linux, 512x512 recommended)

Until then, `electron-builder` falls back to its own default icon.
