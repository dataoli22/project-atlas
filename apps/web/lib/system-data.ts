import { requestJson } from "@/lib/api";
import webPackageJson from "../package.json";

export type DependencyCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type SystemHealthData = {
  status: string;
  appName: string;
  backendVersion: string;
  checks: DependencyCheck[];
};

type HealthApiResponse = {
  status: string;
  app_name: string;
  version: string;
  checks: DependencyCheck[];
};

export const WEB_BUILD_VERSION: string = webPackageJson.version;

export async function getSystemHealthData() {
  const fallback: HealthApiResponse = {
    status: "unknown",
    app_name: "Project Atlas API",
    version: "unknown",
    checks: []
  };

  const result = await requestJson<HealthApiResponse>("/api/v1/health", { fallback });

  const data: SystemHealthData = {
    status: result.data.status,
    appName: result.data.app_name,
    backendVersion: result.data.version,
    checks: result.data.checks
  };

  return { data, source: result.source };
}
