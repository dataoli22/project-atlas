const { contextBridge } = require("electron");

function readApiBaseUrlFromArgv() {
  const prefix = "--atlas-api-base-url=";
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const apiBaseUrl = readApiBaseUrlFromArgv();

// Deliberately minimal: the renderer is the existing Next.js web app, which already talks to
// the local API sidecar over plain HTTP. The only thing it needs from the main process is the
// dynamically-allocated API port (see main.js's findFreePort) - apps/web/lib/api.ts reads this
// back via window.atlasDesktop.apiBaseUrl.
if (apiBaseUrl) {
  contextBridge.exposeInMainWorld("atlasDesktop", {
    isDesktop: true,
    apiBaseUrl,
  });
}
