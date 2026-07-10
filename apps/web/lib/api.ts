import { DEFAULT_API_URL } from "@atlas/config";

type FetchJsonOptions<T> = {
  fallback: T;
};

export type ApiDataSource = "api" | "stub";

type RequestJsonOptions<T> = {
  fallback: T;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

export function resolveApiBaseUrl(): string {
  // In the Electron shell, the API sidecar's port is allocated dynamically at launch (see
  // desktop/electron/main.js), so it can't be baked into the client bundle at build time the way
  // NEXT_PUBLIC_ATLAS_API_URL normally is. preload.js exposes the actual resolved port via
  // contextBridge; prefer that when present. This check is a runtime property read (not a
  // process.env.X token), so it survives Next's build-time env substitution correctly.
  if (typeof window !== "undefined" && window.atlasDesktop?.apiBaseUrl) {
    return window.atlasDesktop.apiBaseUrl;
  }
  return process.env.NEXT_PUBLIC_ATLAS_API_URL ?? DEFAULT_API_URL;
}

export async function requestJson<T>(path: string, options: RequestJsonOptions<T>): Promise<{
  data: T;
  source: ApiDataSource;
}> {
  const baseUrl = resolveApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      cache: "no-store",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return {
      data: (await response.json()) as T,
      source: "api"
    };
  } catch {
    return {
      data: options.fallback,
      source: "stub"
    };
  }
}

export async function fetchJson<T>(path: string, options: FetchJsonOptions<T>): Promise<T> {
  const result = await requestJson(path, options);
  return result.data;
}
