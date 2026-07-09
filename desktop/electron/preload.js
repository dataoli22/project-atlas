const { contextBridge, ipcRenderer } = require("electron");

function readApiBaseUrlFromArgv() {
  const prefix = "--atlas-api-base-url=";
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const apiBaseUrl = readApiBaseUrlFromArgv();

// Deliberately minimal: the renderer is the existing Next.js web app, which already talks to
// the local API sidecar over plain HTTP. Exposed here: the dynamically-allocated API port (see
// main.js's findFreePort, read back via apps/web/lib/api.ts's resolveApiBaseUrl), and a small
// IPC bridge for the LAN-pairing toggle, since that preference has to be readable/writable from
// the desktop settings UI but lives outside the API's own state (main.js needs it before the
// sidecar it controls even starts - see main.js's desktopPrefsPath).
contextBridge.exposeInMainWorld("atlasDesktop", {
  isDesktop: true,
  apiBaseUrl,
  lanPairing: {
    get: () => ipcRenderer.invoke("atlas:get-lan-pairing"),
    set: (enabled) => ipcRenderer.invoke("atlas:set-lan-pairing", enabled),
    restart: () => ipcRenderer.invoke("atlas:restart-app"),
  },
});
