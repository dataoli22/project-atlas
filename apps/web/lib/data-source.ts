import type { ApiDataSource } from "@/lib/api";

/** A page combining several independent fetches is only "live" if every one of them is - one
 * stubbed fallback among several live calls still means the user is looking at some fake data,
 * so this is intentionally pessimistic (any "stub" wins) rather than averaging. */
export function combineDataSources(...sources: ApiDataSource[]): ApiDataSource {
  return sources.every((source) => source === "api") ? "api" : "stub";
}
