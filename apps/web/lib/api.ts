import { DEFAULT_API_URL } from "@atlas/config";

type FetchJsonOptions<T> = {
  fallback: T;
};

export type ApiDataSource = "api" | "stub";

type RequestJsonOptions<T> = {
  fallback: T;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

export async function requestJson<T>(path: string, options: RequestJsonOptions<T>): Promise<{
  data: T;
  source: ApiDataSource;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_ATLAS_API_URL ?? DEFAULT_API_URL;

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
