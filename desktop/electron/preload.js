const { contextBridge } = require("electron");

// Deliberately minimal: the renderer is the existing Next.js web app, which already talks to
// the local API sidecar over plain HTTP. Nothing privileged needs to cross into the renderer.
contextBridge.exposeInMainWorld("atlasDesktop", {
  isDesktop: true,
});
