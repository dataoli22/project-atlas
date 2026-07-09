export {};

declare global {
  interface Window {
    /**
     * Exposed by desktop/electron/preload.js via contextBridge when running inside the Electron
     * shell. apiBaseUrl carries the *actual* resolved loopback port for that launch, since ports
     * are allocated dynamically at runtime - this is what lets client components reach the
     * correct sidecar without a build-time NEXT_PUBLIC_ATLAS_API_URL baked into the bundle.
     * Undefined in the regular browser deployment.
     */
    atlasDesktop?: {
      isDesktop: true;
      apiBaseUrl: string;
    };
  }
}
